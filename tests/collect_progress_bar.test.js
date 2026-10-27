'use strict';
/* Ronde 13b: test tampilan progres menu 15 (progress bar + info ok/gagal/skip + ETA) */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));

test('progressBar: 0%, 50%, 100% dan lebar bar', () => {
  const b0 = mkt.progressBar(0, 1500);
  assert.match(b0, /0%/);
  assert.equal((b0.match(/█/g) || []).length, 0);
  const b50 = mkt.progressBar(750, 1500);
  assert.match(b50, /50%/);
  assert.equal((b50.match(/█/g) || []).length, 15);
  assert.equal((b50.match(/░/g) || []).length, 15);
  const b100 = mkt.progressBar(1500, 1500);
  assert.match(b100, /100%/);
  assert.equal((b100.match(/░/g) || []).length, 0);
  // total bar selalu 30 karakter
  assert.equal((b50.match(/[█░]/g) || []).length, 30);
});

test('progressBar: aman untuk total 0 dan done melebihi total', () => {
  assert.match(mkt.progressBar(0, 0), /0%/);
  assert.match(mkt.progressBar(2000, 1500), /100%/);
});

test('formatScanProgress: memuat semua info yang diminta', () => {
  const line = mkt.formatScanProgress({ done: 700, total: 1500, ok: 612, failed: 84, permanent: 4, elapsedMs: 60000 });
  assert.match(line, /700\/1500 tx/);
  assert.match(line, /ok 612/);
  assert.match(line, /gagal 84/);
  assert.match(line, /skip 4/);
  assert.match(line, /11\.7 tx\/dtk/);
  assert.match(line, /ETA ~69 dtk/);
  assert.match(line, /47%/);
});

test('formatScanProgress: ETA menit bila lama', () => {
  const line = mkt.formatScanProgress({ done: 100, total: 1500, ok: 90, failed: 10, permanent: 0, elapsedMs: 100000 });
  assert.match(line, /ETA ~\d+ mnt/);
});

test('formatRetryProgress: bar retry pass', () => {
  const line = mkt.formatRetryProgress({ pass: 1, passDone: 60, passTotal: 150, recovered: 12 });
  assert.match(line, /retry 1/);
  assert.match(line, /60\/150/);
  assert.match(line, /pulih 12/);
  assert.match(line, /40%/);
});

test('collectSignatures: onProgress menerima info ok/permanent/elapsedMs', async () => {
  const calls = [];
  const fetchOne = async (sig) => sig === 'a'
    ? { status: 'ok', flows: [], block_time: 1 }
    : { status: 'retryable', reason: 'timeout_aborted' };
  await mkt.collectSignatures(['a', 'b'], fetchOne,
    { delayMs: 0, timeoutMs: 50, retryPasses: 0, retryDelayMs: 0 },
    (done, total, failedCount, pass, rec, info) => calls.push({ done, total, failedCount, pass, info }));
  assert.ok(calls.length >= 2, 'callback harus dipanggil tiap item');
  const last = calls[calls.length - 1];
  assert.equal(last.done, 2);
  assert.equal(last.total, 2);
  assert.equal(last.pass, 0);
  assert.equal(last.info.ok, 1);
  assert.equal(last.failedCount, 1);
  assert.ok(typeof last.info.elapsedMs === 'number');
});

test('collectSignatures: retry pass melaporkan passDone/passTotal dan passComplete', async () => {
  const calls = [];
  let n = 0;
  const fetchOne = async () => (++n === 1
    ? { status: 'retryable', reason: 'timeout_aborted' }
    : { status: 'ok', flows: [], block_time: 1 });
  const r = await mkt.collectSignatures(['s0'], fetchOne,
    { delayMs: 0, timeoutMs: 50, retryPasses: 1, retryDelayMs: 0 },
    (done, total, failedCount, pass, rec, info) => calls.push({ pass, info }));
  assert.equal(r.recovered, 1);
  const endCalls = calls.filter(c => c.pass === 1 && c.info && c.info.passComplete);
  assert.equal(endCalls.length, 1);
  assert.equal(endCalls[0].info.passDone, 1);
  assert.equal(endCalls[0].info.passTotal, 1);
});
