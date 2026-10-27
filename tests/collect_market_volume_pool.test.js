'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));

const T0 = 1700000000;
const OPTS = { delayMs: 0, timeoutMs: 100, retryPasses: 0, retryDelayMs: 0, concurrency: 3 };
const flow = (owner, kind, amt) => ({ owner, kind,
  token_delta_raw: kind === 'SELL' ? -BigInt(amt) : BigInt(amt), sol_delta_lamports: 0 });

// Mock dengan delay acak agar completion order tidak deterministik.
const sleep = ms => new Promise(r => setTimeout(r, ms));
function flakyFetch(failSet = new Set()) {
  return async (sig) => {
    await sleep(Math.floor(Math.random() * 15));
    if (failSet.has(sig)) return { status: 'retryable', reason: 'timeout' };
    const i = Number(sig.slice(1));
    return { status: 'ok', block_time: T0 + i, flows: [flow(i % 2 ? 'A' : 'B', i % 2 ? 'SELL' : 'BUY', 100)] };
  };
}

test('pool concurrency=3 vs 1: agregat identik', async () => {
  const sigs = ['s0', 's1', 's2', 's3', 's4', 's5'];
  const r1 = await mkt.collectSignatures(sigs, flakyFetch(), { ...OPTS, concurrency: 1 });
  const r3 = await mkt.collectSignatures(sigs, flakyFetch(), { ...OPTS, concurrency: 3 });
  for (const [a, b] of [[r1.state, r3.state]]) {
    assert.equal(a.buyVol, b.buyVol);
    assert.equal(a.sellVol, b.sellVol);
    assert.equal(a.parsed, b.parsed);
    assert.deepEqual(
      { r: a.halfTotals.recent.sell, o: a.halfTotals.older.sell },
      { r: b.halfTotals.recent.sell, o: b.halfTotals.older.sell });
  }
});

test('paruh window tetap benar walau completion acak (berdasar index)', async () => {
  const sigs = ['s0', 's1', 's2', 's3'];
  // s0,s1 = recent: SELL 100+100 oleh A; s2,s3 = older: BUY 100+100 oleh B
  const fetchOne = async (sig) => {
    await sleep(Math.floor(Math.random() * 15));
    const i = Number(sig.slice(1));
    const recent = i < 2;
    return { status: 'ok', block_time: T0 + i,
      flows: [recent ? flow('A', 'SELL', 100) : flow('B', 'BUY', 100)] };
  };
  const { state } = await mkt.collectSignatures(sigs, fetchOne, OPTS);
  assert.equal(state.halfTotals.recent.sell, 200n);
  assert.equal(state.halfTotals.older.buy, 200n);
  assert.equal(state.halfTotals.recent.buy, 0n);
  assert.equal(state.halfTotals.older.sell, 0n);
});

test('retry tetap jalan di dalam pool', async () => {
  let n = 0;
  const fetchOne = async (sig) => {
    n++;
    if (sig === 's1' && n <= 2) return { status: 'retryable', reason: 'timeout' };
    return { status: 'ok', block_time: T0, flows: [flow('A', 'SELL', 50)] };
  };
  const { state, recovered, failed } = await mkt.collectSignatures(['s0', 's1'], fetchOne,
    { ...OPTS, retryPasses: 1 });
  assert.equal(recovered, 1);
  assert.deepEqual(failed, []);
  assert.equal(state.sellVol, 100n);
});

test('resolveCollectorOpts: precedence concurrency CLI > config > default; clamp 1-8', () => {
  const base = { maxTx: 1500, delayMs: 300, pageLimit: 1000, retryPasses: 2, retryDelayMs: 1500, timeoutMs: 25000 };
  assert.equal(mkt.resolveCollectorOpts({ ...base }, {}).concurrency, 3);
  assert.equal(mkt.resolveCollectorOpts({ ...base }, { concurrency: 5 }).concurrency, 5);
  assert.equal(mkt.resolveCollectorOpts({ ...base, concurrency: 2 }, { concurrency: 5 }).concurrency, 2);
  assert.equal(mkt.resolveCollectorOpts({ ...base }, { concurrency: 99 }).concurrency, 8);
  assert.equal(mkt.resolveCollectorOpts({ ...base }, { concurrency: 0 }).concurrency, 1);
});

test('alasan retryable dicatat dan dinormalisasi (diagnostik gagal jaringan)', async () => {
  const fetchOne = async (sig) => {
    if (sig === 's0') return { status: 'retryable', reason: 'fetch_error:HTTP_429' };
    if (sig === 's1') return { status: 'retryable', reason: 'fetch_error:This operation was aborted' };
    if (sig === 's2') return { status: 'retryable', reason: 'fetch_error:fetch failed' };
    return { status: 'ok', block_time: 1700000000, flows: [] };
  };
  const { failed, retryReasons } = await mkt.collectSignatures(['s0', 's1', 's2', 's3'], fetchOne,
    { delayMs: 0, timeoutMs: 100, retryPasses: 0, retryDelayMs: 0, concurrency: 2 });
  assert.deepEqual(failed.sort(), ['s0', 's1', 's2']);
  assert.equal(retryReasons['HTTP_429_rate_limited'], 1);
  assert.equal(retryReasons['timeout_aborted'], 1);
  assert.equal(retryReasons['network_fetch_failed'], 1);
});
