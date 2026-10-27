'use strict';
/* Ronde 22: regresi bug Phase 10 (laporan Rin 2026-10-21, token
 * 8nnaeWCw...). Di Ronde 18 menu interaktif Phase 10 dicabut dan main()
 * kehilangan async-nya, tapi pemanggil CLI tetap main().catch(...) —
 * main() mengembalikan undefined -> TypeError "Cannot read properties
 * of undefined (reading 'catch')" SETELAH phase10-result.json tertulis
 * dan ringkasan tercetak; proses keluar kode 1 sehingga pipeline
 * membacanya sebagai "Phase 10 gagal".
 * Test lama tidak menangkapnya karena semua mengimpor fungsi modul —
 * tidak ada yang menjalankan script sebagai CLI. Test ini menjalankan
 * script sungguhan sebagai proses anak di salinan sementara. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const MINT = '8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq';

function makeTempInstall() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sti-r22-'));
  fs.cpSync(path.join(root, 'Script'), path.join(tmp, 'Script'), { recursive: true });
  const outSrc = path.join(root, 'Output', MINT);
  const outDst = path.join(tmp, 'Output', MINT);
  fs.mkdirSync(outDst, { recursive: true });
  for (const f of fs.readdirSync(outSrc)) {
    if (/^phase[1-9]-result\.json$/.test(f) || f === 'scan-context.json') {
      fs.copyFileSync(path.join(outSrc, f), path.join(outDst, f));
    }
  }
  return tmp;
}

test('CLI phase 10: keluar kode 0, tanpa TypeError, hasil tertulis', () => {
  const tmp = makeTempInstall();
  try {
    const r = spawnSync(process.execPath,
      [path.join(tmp, 'Script', 'phase10_scoring_engine.js'), '--mint', MINT],
      { encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 0, `exit=${r.status}\nstderr:\n${r.stderr}`);
    assert.doesNotMatch(r.stderr || '', /Cannot read properties of undefined/);
    assert.match(r.stdout, /PHASE 10 — SCORING ENGINE/);
    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'Output', MINT, 'phase10-result.json'), 'utf8'));
    assert.ok(written && typeof written === 'object');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('sumber phase 10: main() async (pemanggil memakai .catch)', () => {
  const src = fs.readFileSync(path.join(root, 'Script', 'phase10_scoring_engine.js'), 'utf8');
  assert.match(src, /async function main\(\)/);
  assert.match(src, /main\(\)\.catch\(/);
});
