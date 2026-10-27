'use strict';
/* Ronde 13: test modul throttle global Helius RPC (Script/rpc_throttle.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const throttle = require(path.join('..', 'Script', 'rpc_throttle.js'));

test('configure: default saat section tidak ada', () => {
  throttle.resetState();
  const s = throttle.configure({});
  assert.equal(s.min_interval_ms, 110);
  assert.equal(s.max_delay_ms, 30000);
  assert.deepEqual([...s.retryable_statuses].sort((a, b) => a - b), [408, 429, 500, 502, 503, 504]);
});

test('configure: nilai custom dipakai, nilai invalid jatuh ke default', () => {
  throttle.resetState();
  const s = throttle.configure({ rpc_throttle: { min_interval_ms: 200, max_delay_ms: 5000, retryable_statuses: [429, 503] } });
  assert.equal(s.min_interval_ms, 200);
  assert.equal(s.max_delay_ms, 5000);
  assert.deepEqual([...s.retryable_statuses].sort((a, b) => a - b), [429, 503]);
  const s2 = throttle.configure({ rpc_throttle: { min_interval_ms: -5, max_delay_ms: 'x' } });
  assert.equal(s2.min_interval_ms, 110);
  assert.equal(s2.max_delay_ms, 30000);
});

test('isRetryableStatus mengikuti config', () => {
  throttle.resetState();
  throttle.configure({});
  assert.equal(throttle.isRetryableStatus(429), true);
  assert.equal(throttle.isRetryableStatus(503), true);
  assert.equal(throttle.isRetryableStatus(404), false);
  assert.equal(throttle.isRetryableStatus(200), false);
  throttle.configure({ rpc_throttle: { retryable_statuses: [429] } });
  assert.equal(throttle.isRetryableStatus(503), false);
  assert.equal(throttle.isRetryableStatus(429), true);
});

test('takeSlot: menegakkan jeda antar request (override)', async () => {
  throttle.resetState();
  const t0 = Date.now();
  await throttle.takeSlot(60);
  await throttle.takeSlot(60);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 50, `jeda terlalu pendek: ${elapsed}ms`);
  assert.ok(elapsed < 3000, `jeda terlalu lama: ${elapsed}ms`);
});

test('takeSlot: memakai min_interval_ms dari config bila tanpa override', async () => {
  throttle.resetState();
  throttle.configure({ rpc_throttle: { min_interval_ms: 80 } });
  const t0 = Date.now();
  await throttle.takeSlot();
  await throttle.takeSlot();
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 65, `jeda terlalu pendek: ${elapsed}ms`);
});

test('takeSlot: slot bersifat global — pemanggil berbeda saling antre', async () => {
  throttle.resetState();
  const t0 = Date.now();
  // dua "worker" memanggil berurutan: total jeda ~2x interval
  await throttle.takeSlot(50);
  await throttle.takeSlot(50);
  await throttle.takeSlot(50);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 90, `slot tidak global: ${elapsed}ms`);
});

test('delayUntil: mendorong slot ke depan (dipakai cooldown 429 phase8)', async () => {
  throttle.resetState();
  await throttle.takeSlot(0);
  throttle.delayUntil(Date.now() + 120);
  const t0 = Date.now();
  await throttle.takeSlot(0);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 90, `cooldown tidak dihormati: ${elapsed}ms`);
  assert.ok(elapsed < 3000, `cooldown terlalu lama: ${elapsed}ms`);
});

test('retryAfterMs: parse detik angka, tanggal HTTP, dan invalid', () => {
  assert.equal(throttle.retryAfterMs('2'), 2000);
  assert.equal(throttle.retryAfterMs(5), 5000);
  assert.equal(throttle.retryAfterMs(null), 0);
  assert.equal(throttle.retryAfterMs('bukan-angka'), 0);
  const future = new Date(Date.now() + 3000).toUTCString();
  const v = throttle.retryAfterMs(future);
  assert.ok(v > 1000 && v <= 3000, `HTTP-date parse aneh: ${v}`);
});

test('backoffMs: eksponensial + jitter pola dokumentasi Helius', () => {
  throttle.resetState();
  throttle.configure({ rpc_throttle: { max_delay_ms: 30000 } });
  // attempt 1, base 1000 -> [750, 1250]
  for (let i = 0; i < 20; i++) {
    const d = throttle.backoffMs(1, 1000);
    assert.ok(d >= 750 && d <= 1250, `attempt1 di luar rentang jitter: ${d}`);
  }
  // attempt 2, base 1000 -> [1500, 2500]; attempt 3 -> [3000, 5000]
  const d2 = throttle.backoffMs(2, 1000);
  assert.ok(d2 >= 1500 && d2 <= 2500, `attempt2: ${d2}`);
  const d3 = throttle.backoffMs(3, 1000);
  assert.ok(d3 >= 3000 && d3 <= 5000, `attempt3: ${d3}`);
});

test('backoffMs: dibatasi max_delay_ms dan tidak di bawah Retry-After', () => {
  throttle.resetState();
  throttle.configure({ rpc_throttle: { max_delay_ms: 4000 } });
  const d = throttle.backoffMs(10, 1000); // 1000*2^9 = 512000 -> cap 4000 * jitter
  assert.ok(d <= 5000, `melebihi cap: ${d}`);
  const dRa = throttle.backoffMs(1, 1000, 9000); // Retry-After 9 detik menang
  assert.ok(dRa >= 9000, `Retry-After tidak dihormati: ${dRa}`);
});

test('pola dokumentasi: loop 6 request beruntun tidak menembus ~10/dtk', async () => {
  throttle.resetState();
  throttle.configure({ rpc_throttle: { min_interval_ms: 110 } });
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) await throttle.takeSlot(); // pola "await ... setTimeout(110)" di doc
  const elapsed = Date.now() - t0;
  // 5 jeda x 110ms = 550ms minimum -> laju <= ~10.9 req/dtk (batas timer longgar)
  assert.ok(elapsed >= 450, `laju melebihi budget: 6 request dalam ${elapsed}ms`);
  assert.ok(elapsed < 8000, `terlalu lambat: ${elapsed}ms`);
});

test('resetState: mengembalikan default dan mengosongkan slot', async () => {
  throttle.configure({ rpc_throttle: { min_interval_ms: 500 } });
  await throttle.takeSlot();
  throttle.resetState();
  assert.equal(throttle.getSettings().min_interval_ms, 110);
  const t0 = Date.now();
  await throttle.takeSlot(0);
  assert.ok(Date.now() - t0 < 1000, 'slot tidak ter-reset');
});
