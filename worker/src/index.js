/* ==========================================================================
   STONKEX rewards indexer — Cloudflare Worker
   --------------------------------------------------------------------------
   cron  → indexes forward from the saved cursor, banking totals in KV
   GET /        → the JSON the site reads (same shape as data/rewards.json)
   GET /debug   → sync state: cursor, head, blocks behind, raw stream totals
   POST /reset  → clear state and rescan from START_BLOCK (needs ADMIN_TOKEN)
   ========================================================================== */

import { indexRange, makeRpc, toNumber, countHolders } from './indexer.js';
import {
  STREAMS, START_BLOCK, CHUNK_SIZE, MAX_CHUNKS_PER_RUN, CONFIRMATIONS,
  DEXSCREENER_KEX_TOKEN, TOKENS, CONTRACTS, EXCLUDE_FROM_HOLDERS,
} from './config.js';

const STATE_KEY = 'state:v1';
const BALANCES_KEY = 'balances:v1';

const SUM_STREAMS = STREAMS.filter((s) => s.kind !== 'balances');
const BALANCE_STREAMS = STREAMS.filter((s) => s.kind === 'balances');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short edge cache: the cron writes at most once a minute anyway.
      'cache-control': 'public, max-age=30',
      ...CORS,
      ...extraHeaders,
    },
  });
}

async function loadState(env) {
  const raw = await env.STONKEX.get(STATE_KEY, 'json');
  if (!raw) return { cursor: START_BLOCK, totals: {}, updatedAt: null, lastError: null };
  return raw;
}

async function saveState(env, state) {
  await env.STONKEX.put(STATE_KEY, JSON.stringify(state));
}

/** Totals live in KV as decimal strings — JSON has no BigInt. */
function totalsToBigInt(totals) {
  const out = {};
  SUM_STREAMS.forEach((s) => { out[s.id] = BigInt((totals && totals[s.id]) || '0'); });
  return out;
}

/* Balances are a per-address running map, kept across runs. Each scan returns
   deltas for the blocks it covered, which are added in here. */
async function loadBalances(env) {
  return (await env.STONKEX.get(BALANCES_KEY, 'json')) || {};
}

function mergeDeltas(stored, deltas) {
  for (const addr in deltas) {
    const next = BigInt(stored[addr] || '0') + deltas[addr];
    if (next === 0n) delete stored[addr];        // keep the map from growing forever
    else stored[addr] = next.toString();
  }
  return stored;
}

function holderCount(balances) {
  const filtered = {};
  for (const a in balances) {
    if (EXCLUDE_FROM_HOLDERS.indexOf(a) === -1) filtered[a] = balances[a];
  }
  return countHolders(filtered);
}

function totalsToStrings(totals) {
  const out = {};
  Object.keys(totals).forEach((k) => { out[k] = totals[k].toString(); });
  return out;
}

/** Current $STONKEX price in USD, or null. Never fatal — totals matter more. */
async function kexPriceUsd(fetchImpl) {
  const f = fetchImpl || fetch;
  for (const url of [DEXSCREENER_KEX_TOKEN]) {
    try {
      const res = await f(url, { headers: { accept: 'application/json' } });
      if (!res.ok) continue;
      const d = await res.json();
      const pairs = (d && d.pairs) || [];
      const best = pairs
        .filter((p) => p.chainId === 'base' &&
          String(p.baseToken?.address || '').toLowerCase() === TOKENS.KEX.toLowerCase())
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const price = parseFloat(best?.priceUsd);
      if (isFinite(price) && price > 0) return price;
    } catch (e) { /* keep going */ }
  }
  return null;
}

async function sync(env, ctx) {
  const rpc = makeRpc(env.RPC_URL);
  const state = await loadState(env);

  const head = parseInt(await rpc('eth_blockNumber'), 16) - CONFIRMATIONS;
  if (!isFinite(head) || head <= 0) throw new Error('bad head block');

  const running = totalsToBigInt(state.totals);
  let balances = BALANCE_STREAMS.length ? await loadBalances(env) : null;

  if (state.cursor <= head) {
    const res = await indexRange({
      rpc,
      streams: STREAMS,
      from: state.cursor,
      to: head,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS_PER_RUN,
    });

    SUM_STREAMS.forEach((s) => { running[s.id] += res.totals[s.id]; });
    BALANCE_STREAMS.forEach((s) => { balances = mergeDeltas(balances, res.balances[s.id]); });

    state.cursor = res.cursor;
    state.complete = res.complete;
    state.chunksLastRun = res.chunksUsed;

    if (balances) await env.STONKEX.put(BALANCES_KEY, JSON.stringify(balances));
  }

  state.holders = balances ? holderCount(balances) : null;
  state.addressesTracked = balances ? Object.keys(balances).length : null;
  state.totals = totalsToStrings(running);
  state.head = head;
  state.updatedAt = new Date().toISOString();
  state.lastError = null;

  await saveState(env, state);
  return state;
}

/** Shape the site expects. Unknown values stay null so tiles show a dash. */
function present(state, price) {
  const totals = totalsToBigInt(state.totals);
  const byId = {};
  SUM_STREAMS.forEach((s) => { byId[s.id] = toNumber(totals[s.id], s.decimals); });

  const distributed = byId.distributed ?? null;
  const feesIn = byId.feesIn ?? null;

  return {
    totalDistributed: distributed,
    totalDistributedUsd: price != null && distributed != null ? distributed * price : null,
    // Cumulative fees valued at the CURRENT price, not the price at the time of
    // each transfer. Good enough for a headline figure; say so if it matters.
    totalFeesCollected: price != null && feesIn != null ? feesIn * price : null,

    // Counted from transfers, so no explorer is involved. Only trustworthy once
    // the backfill has finished — a partial scan under-counts.
    holders: state.complete ? (state.holders ?? null) : null,

    updatedAt: state.updatedAt,
    meta: {
      synced: !!state.complete,
      blocksBehind: state.head && state.cursor ? Math.max(0, state.head - state.cursor + 1) : null,
      kexPriceUsd: price,
    },
  };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sync(env, ctx).catch(async (err) => {
      const state = await loadState(env);
      state.lastError = String(err && err.message || err);
      state.updatedAt = new Date().toISOString();
      await saveState(env, state);
    }));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/reset' && request.method === 'POST') {
      const auth = request.headers.get('authorization') || '';
      if (!env.ADMIN_TOKEN || auth !== 'Bearer ' + env.ADMIN_TOKEN) {
        return json({ error: 'unauthorized' }, 401);
      }
      await env.STONKEX.delete(STATE_KEY);
      await env.STONKEX.delete(BALANCES_KEY);
      return json({ ok: true, message: 'state cleared; next cron rescans from ' + START_BLOCK });
    }

    const state = await loadState(env);

    if (url.pathname === '/debug') {
      return json({
        cursor: state.cursor,
        head: state.head ?? null,
        blocksBehind: state.head ? Math.max(0, state.head - state.cursor + 1) : null,
        synced: !!state.complete,
        chunksLastRun: state.chunksLastRun ?? null,
        updatedAt: state.updatedAt,
        lastError: state.lastError,
        startBlock: START_BLOCK,
        holders: state.holders ?? null,
        addressesTracked: state.addressesTracked ?? null,
        rawTotals: state.totals,          // base units, as indexed
        streams: STREAMS.map((s) => ({
          id: s.id, kind: s.kind || 'sum', token: s.token,
          from: s.from || null, to: s.to || null,
        })),
        contracts: CONTRACTS,
      }, 200, { 'cache-control': 'no-store' });
    }

    // Let a manual GET /sync push it along too, handy while backfilling.
    if (url.pathname === '/sync') {
      try {
        const next = await sync(env, ctx);
        const price = await kexPriceUsd();
        return json(present(next, price), 200, { 'cache-control': 'no-store' });
      } catch (err) {
        return json({ error: String(err && err.message || err) }, 502, { 'cache-control': 'no-store' });
      }
    }

    const price = await kexPriceUsd();
    return json(present(state, price));
  },
};
