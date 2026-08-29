#!/usr/bin/env node
/* ==========================================================================
   Reward indexer — GitHub Actions edition
   --------------------------------------------------------------------------
   Same scan logic as worker/, but state lives in the repo instead of KV and
   the output is committed as data/rewards.json — which the site already reads.
   So this needs no Cloudflare account, no KV, no secrets: just Actions.

   Run locally:  RPC_URL=https://mainnet.base.org node scripts/index-rewards.mjs
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { indexRange, makeRpc, toNumber, countHolders } from '../worker/src/indexer.js';
import {
  STREAMS, START_BLOCK, CHUNK_SIZE, CONFIRMATIONS, EXCLUDE_FROM_HOLDERS, TOKENS,
} from '../worker/src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = path.join(ROOT, 'data', 'rewards-state.json');
const OUT_FILE = path.join(ROOT, 'data', 'rewards.json');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
// A run is bounded by wall clock, not chunk count: Actions bills by the minute
// and a backfill can always finish on the next run.
const BUDGET_MS = Number(process.env.BUDGET_MS || 8 * 60 * 1000);

const SUM_STREAMS = STREAMS.filter((s) => s.kind !== 'balances');
const BALANCE_STREAMS = STREAMS.filter((s) => s.kind === 'balances');

const readJson = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
};

function loadState() {
  const s = readJson(STATE_FILE, null);
  return s || { cursor: START_BLOCK, totals: {}, balances: {}, head: null, updatedAt: null };
}

function holderCount(balances) {
  const kept = {};
  for (const a in balances) if (!EXCLUDE_FROM_HOLDERS.includes(a)) kept[a] = balances[a];
  return countHolders(kept);
}

async function kexPriceUsd() {
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/tokens/' + TOKENS.KEX,
      { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const d = await res.json();
    const best = (d.pairs || [])
      .filter((p) => p.chainId === 'base' &&
        String(p.baseToken?.address || '').toLowerCase() === TOKENS.KEX.toLowerCase())
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    const price = parseFloat(best?.priceUsd);
    return isFinite(price) && price > 0 ? price : null;
  } catch { return null; }
}

async function main() {
  const started = Date.now();
  const rpc = makeRpc(RPC_URL);
  const state = loadState();

  const head = parseInt(await rpc('eth_blockNumber'), 16) - CONFIRMATIONS;
  if (!isFinite(head) || head <= 0) throw new Error('bad head block from ' + RPC_URL);

  const totals = {};
  SUM_STREAMS.forEach((s) => { totals[s.id] = BigInt(state.totals?.[s.id] || '0'); });
  const balances = { ...(state.balances || {}) };

  let cursor = state.cursor;
  let passes = 0;

  // Keep scanning until caught up or out of time.
  while (cursor <= head && Date.now() - started < BUDGET_MS) {
    const res = await indexRange({
      rpc, streams: STREAMS, from: cursor, to: head,
      chunkSize: CHUNK_SIZE, maxChunks: 40,
    });

    SUM_STREAMS.forEach((s) => { totals[s.id] += res.totals[s.id]; });
    for (const s of BALANCE_STREAMS) {
      for (const [addr, delta] of Object.entries(res.balances[s.id])) {
        const next = BigInt(balances[addr] || '0') + delta;
        if (next === 0n) delete balances[addr]; else balances[addr] = next.toString();
      }
    }

    if (res.cursor === cursor) break;          // no progress; don't spin
    cursor = res.cursor;
    passes++;
    process.stdout.write(`  scanned to ${cursor - 1} (${head - cursor + 1} behind)\n`);
  }

  const complete = cursor > head;
  const price = await kexPriceUsd();

  const distributed = toNumber(totals.distributed ?? 0n, 18);
  const feesIn = toNumber(totals.feesIn ?? 0n, 18);
  const holders = holderCount(balances);

  fs.writeFileSync(STATE_FILE, JSON.stringify({
    cursor, head, complete, passes,
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v.toString()])),
    balances,
    updatedAt: new Date().toISOString(),
  }, null, 0) + '\n');

  // Preserve the doc block so the file stays self-explanatory.
  const prev = readJson(OUT_FILE, {});
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    ...(prev.__doc ? { __doc: prev.__doc } : {}),
    totalDistributed: complete ? distributed : null,
    totalDistributedUsd: complete && price != null ? distributed * price : null,
    totalFeesCollected: complete && price != null ? feesIn * price : null,
    holders: complete ? holders : null,
    updatedAt: new Date().toISOString(),
    meta: { synced: complete, blocksBehind: Math.max(0, head - cursor + 1), kexPriceUsd: price },
  }, null, 2) + '\n');

  console.log(complete
    ? `synced · distributed ${distributed} · fees ${feesIn} KEX · holders ${holders} · price ${price}`
    : `partial · ${head - cursor + 1} blocks behind · continues next run`);
}

main().catch((err) => { console.error('indexer failed:', err.message); process.exit(1); });
