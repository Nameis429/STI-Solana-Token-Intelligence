'use strict';
/* Ronde 24 (keputusan Rin 2026-10-27, perbaikan bug scan ulang Baton):
 * menu C mengarsipkan hasil lama dengan cara PINDAH (default P2) sebelum
 * phase apa pun berjalan. Akibatnya Phase 14 (collect_funding_graph)
 * tidak menemukan phase8-result.json — file itu sudah dipindah ke
 * history/ — dan Phase 03 kehilangan phase1/2-result.json. Scan ulang
 * gagal berantai padahal argumen mint sudah diteruskan dengan benar.
 * Perbaikan: menu C memakai arsip SALINAN (opts.copy) — history tetap
 * menyimpan run lama, file asli tetap di tempat untuk dibaca sebagai
 * input selama scan ulang. Menu A tetap memakai mode pindah. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = path.join(__dirname, '..');
const { archivePreviousRun } = require(path.join(root, 'Script/scan_history.js'));

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sti-ronde24-'));
  const ctx = { run_id: '24fc517c-test', mint: 'TESTMINT', started_at: '2026-10-21T00:00:00.000Z', mode: 'full_pipeline' };
  fs.writeFileSync(path.join(dir, 'scan-context.json'), JSON.stringify(ctx));
  fs.writeFileSync(path.join(dir, 'phase8-result.json'), JSON.stringify({ mint: 'TESTMINT', wallets: [] }));
  fs.writeFileSync(path.join(dir, 'phase1-result.json'), JSON.stringify({ mint: 'TESTMINT' }));
  fs.writeFileSync(path.join(dir, 'phase2-result.json'), JSON.stringify({ mint: 'TESTMINT' }));
  fs.writeFileSync(path.join(dir, 'liquidity_history.jsonl'), '{}\n');
  return dir;
}

test('arsip salinan: file asli tetap di tempat DAN history berisi salinan identik', () => {
  const dir = fixture();
  const r = archivePreviousRun(dir, { copy: true });
  assert.equal(r.archived, true);
  const hist = path.join(dir, 'history', r.folder);
  for (const f of ['scan-context.json', 'phase8-result.json', 'phase1-result.json', 'phase2-result.json']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `${f} harus tetap di root`);
    assert.equal(
      fs.readFileSync(path.join(hist, f), 'utf8'),
      fs.readFileSync(path.join(dir, f), 'utf8'),
      `${f} di history harus identik dengan aslinya`);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(hist, 'ARCHIVE_INFO.json'), 'utf8')).archive_mode, 'copy');
  assert.ok(fs.existsSync(path.join(dir, 'liquidity_history.jsonl')), 'liquidity_history.jsonl tidak ikut diarsipkan');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('arsip pindah (default, menu A): file lama berpindah, root bersih', () => {
  const dir = fixture();
  const r = archivePreviousRun(dir);
  assert.equal(r.archived, true);
  assert.ok(!fs.existsSync(path.join(dir, 'phase8-result.json')), 'phase8 harus pindah dari root');
  assert.ok(fs.existsSync(path.join(dir, 'history', r.folder, 'phase8-result.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'history', r.folder, 'ARCHIVE_INFO.json'), 'utf8')).archive_mode, 'move');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('main.js: runRescan memakai archiveStep salinan, runAll tetap pindah', () => {
  const src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const rescanStart = src.indexOf('async function runRescan');
  const rescanEnd = src.indexOf('function runSetKey', rescanStart);
  const rescanSeg = src.slice(rescanStart, rescanEnd);
  assert.match(rescanSeg, /archiveStep\(scanDir, \{ copy: true \}\)/);
  const allStart = src.indexOf('async function runAll');
  const allEnd = src.indexOf('async function runCollectors', allStart);
  const allSeg = src.slice(allStart, allEnd);
  assert.match(allSeg, /archiveStep\(scanDir\)/);
  assert.doesNotMatch(allSeg, /copy: true/);
});
