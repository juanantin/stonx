/* End-to-end over the Worker's own handlers, with a fake KV and RPC: proves
   totals survive the KV round-trip (BigInt is stored as a string), that a
   second run resumes instead of re-counting, and that the served payload is
   the shape the site reads. */

import assert from 'node:assert/strict';
import test from 'node:test';

const word = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');
const E18 = 10n ** 18n;

function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(k, type) { const v = store.get(k); return v == null ? null : (type === 'json' ? JSON.parse(v) : v); },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

/* Chain with one distribution and one fee transfer, plus a moving head. */
function makeEnv(head, transfers) {
  const KV = fakeKV();
  const rpcCalls = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('dexscreener')) {
      return { ok: true, json: async () => ({ pairs: [{
        chainId: 'base',
        baseToken: { address: '0x5ab000ff9B9FfE0349CE5ffA5fD86f217C3680F5' },
        liquidity: { usd: 3400000 }, priceUsd: '0.25',
      }]}) };
    }
    const body = JSON.parse(init.body);
    rpcCalls.push(body.method);
    if (body.method === 'eth_blockNumber') {
      return { ok: true, json: async () => ({ result: '0x' + head.toString(16) }) };
    }
    const f = body.params[0];
    const from = parseInt(f.fromBlock, 16), to = parseInt(f.toBlock, 16);
    const isDistributed = f.topics.length === 2;      // from-filter
    const key = isDistributed ? 'distributed' : 'feesIn';
    const logs = (transfers[key] || [])
      .filter(([b]) => b >= from && b <= to)
      .map(([, amt]) => ({ data: word(amt) }));
    return { ok: true, json: async () => ({ result: logs }) };
  };
  return { env: { STONKEX: KV, RPC_URL: 'http://rpc.test', ADMIN_TOKEN: 'secret' }, KV, rpcCalls };
}

const START = 50530608;

/* The real runtime keeps a Worker alive until every waitUntil promise settles,
   so the fake has to as well — otherwise scheduled() returns before the sync
   it kicked off has written anything. */
function makeCtx() {
  const pending = [];
  return { waitUntil: (p) => pending.push(p), settled: () => Promise.all(pending) };
}

async function runCron(mod, env) {
  const ctx = makeCtx();
  await mod.scheduled({}, env, ctx);
  await ctx.settled();
}

const ctx = makeCtx();

test('cron sync banks totals, then a later run resumes without re-counting', async () => {
  const mod = (await import('../src/index.js')).default;

  // First run: head only a little past the start block.
  const a = makeEnv(START + 999, {
    distributed: [[START + 10, 5n * E18], [START + 500, 3n * E18]],
    feesIn: [[START + 20, 12n * E18]],
  });
  await runCron(mod, a.env);

  let res = await mod.fetch(new Request('https://w/'), a.env, ctx);
  let body = await res.json();
  assert.equal(body.totalDistributed, 8);
  assert.equal(body.totalFeesCollected, 3);            // 12 KEX × $0.25
  assert.equal(body.totalDistributedUsd, 2);           // 8 KEX × $0.25
  assert.equal(body.meta.synced, true);

  // Head advances; a new distribution lands. Reuse the same KV.
  const b = makeEnv(START + 1999, {
    distributed: [[START + 10, 5n * E18], [START + 500, 3n * E18], [START + 1500, 4n * E18]],
    feesIn: [[START + 20, 12n * E18]],
  });
  b.env.STONKEX = a.KV;                                 // carry state over
  await runCron(mod, b.env);

  res = await mod.fetch(new Request('https://w/'), b.env, ctx);
  body = await res.json();
  // 8 already banked + 4 new. The first two must NOT be counted twice.
  assert.equal(body.totalDistributed, 12);
  assert.equal(body.totalFeesCollected, 3);

  const dbg = await (await mod.fetch(new Request('https://w/debug'), b.env, ctx)).json();
  assert.equal(dbg.blocksBehind, 0);
  assert.equal(dbg.lastError, null);
  assert.equal(dbg.startBlock, START);
  assert.equal(typeof dbg.rawTotals.distributed, 'string');   // stored as string
  assert.equal(dbg.rawTotals.distributed, (12n * E18).toString());
});

test('serves CORS and the documented shape', async () => {
  const mod = (await import('../src/index.js')).default;
  const { env } = makeEnv(START + 99, { distributed: [], feesIn: [] });
  const res = await mod.fetch(new Request('https://w/'), env, ctx);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const body = await res.json();
  for (const k of ['totalDistributed', 'totalDistributedUsd', 'totalFeesCollected', 'updatedAt', 'meta']) {
    assert.ok(k in body, 'missing ' + k);
  }
});

test('reset requires the admin token', async () => {
  const mod = (await import('../src/index.js')).default;
  const { env, KV } = makeEnv(START + 99, { distributed: [[START + 1, E18]], feesIn: [] });
  await runCron(mod, env);
  assert.ok(KV.store.size > 0);

  let res = await mod.fetch(new Request('https://w/reset', { method: 'POST' }), env, ctx);
  assert.equal(res.status, 401);
  assert.ok(KV.store.size > 0, 'state must survive an unauthorised reset');

  res = await mod.fetch(new Request('https://w/reset', {
    method: 'POST', headers: { authorization: 'Bearer secret' },
  }), env, ctx);
  assert.equal(res.status, 200);
  assert.equal(KV.store.size, 0);
});

test('a failing RPC is recorded, not thrown, and totals are kept', async () => {
  const mod = (await import('../src/index.js')).default;
  const { env, KV } = makeEnv(START + 99, { distributed: [[START + 1, 9n * E18]], feesIn: [] });
  await runCron(mod, env);

  globalThis.fetch = async (url) => String(url).includes('dexscreener')
    ? { ok: false, json: async () => ({}) }
    : { ok: false, status: 503, json: async () => ({}) };

  await runCron(mod, env);                              // must not reject
  const dbg = await (await mod.fetch(new Request('https://w/debug'), env, ctx)).json();
  assert.match(dbg.lastError, /503/);
  assert.equal(dbg.rawTotals.distributed, (9n * E18).toString(), 'totals survive an error');
});
