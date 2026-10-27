'use strict';
/* Ronde 20 (P2): arsip riwayat scan + perbandingan antar-scan.
 * - archivePreviousRun: hasil lama pindah ke history/<stempel run>,
 *   liquidity_history.jsonl tetap di tempat; scan pertama = no-op.
 * - buildComparison: delta skor/rule/DB + penanda kerangka Rin
 *   (perbaikan konsisten vs kemungkinan artefak sepi). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { archivePreviousRun, latestHistoryDir } = require(path.join(root, 'Script/scan_history.js'));
const { buildComparison } = require(path.join(root, 'Script/scan_compare.js'));

function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sti-p2-')); }
function writeJson(dir, name, obj) { fs.writeFileSync(path.join(dir, name), JSON.stringify(obj, null, 2)); }

function fakeRun(dir, o) {
  writeJson(dir, 'phase11-result.json', {
    generated_at: o.at,
    summary: {
      final_quality_score: o.score,
      classification: { tier: o.score >= 61 ? 4 : 3, label: o.score >= 61 ? 'Kuat' : 'Sedang' },
      confidence: { score: o.conf },
      coverage: { phase9_rule_evaluated_pct: o.evalPct },
      score_gate: { provisional: false },
      score_variants: { without_db: { score: o.scoreNoDb } },
      fee_utility_status: { status: 'NOT_USED' },
    },
    score_breakdown: [
      { id: 'risk_findings', available: true, score: o.riskDim, details: { db_adjustment: { metrics: { retention: { rate: o.retention } } } } },
    ],
  });
  writeJson(dir, 'phase9-result.json', { rules: o.rules });
  writeJson(dir, 'phase7-result.json', { matches: o.matches });
  writeJson(dir, 'phase8-result.json', { summary: { wallets_scanned: o.scanned, complete_histories: o.complete } });
  writeJson(dir, 'phase4-result.json', { liquidity_mapping: { significant_pools: o.pools.map(p => ({ pool: p })) } });
}
// Himpunan 18 rule KONSTAN (seperti dunia nyata): [mulaiTrig, mulaiNt, mulaiInsuff]
const ruleset = (trig, nt, insuff) => {
  const ids = Array.from({ length: trig + nt + insuff }, (_, i) => `R-${String(i + 1).padStart(2, '0')}`);
  return ids.map((id, i) => ({ rule_id: id, status: i < trig ? 'TRIGGERED' : i < trig + nt ? 'NOT_TRIGGERED' : 'INSUFFICIENT_DATA' }));
};

test('arsip: scan pertama no-op; run berikutnya terarsip, jsonl tetap', () => {
  const dir = mkTmp();
  assert.deepEqual(archivePreviousRun(dir).archived, false);
  writeJson(dir, 'phase9-result.json', { rules: [] });
  writeJson(dir, 'scan-context.json', { run_id: 'r1', mode: 'full_pipeline', started_at: '2026-10-20T16:09:51.107Z' });
  fs.writeFileSync(path.join(dir, 'liquidity_history.jsonl'), '{"a":1}\n');
  const r = archivePreviousRun(dir);
  assert.equal(r.archived, true);
  assert.equal(r.folder, '2026-10-20T16-09-51-107Z');
  assert.ok(fs.existsSync(path.join(dir, 'history', r.folder, 'phase9-result.json')));
  assert.ok(fs.existsSync(path.join(dir, 'history', r.folder, 'ARCHIVE_INFO.json')));
  assert.ok(fs.existsSync(path.join(dir, 'liquidity_history.jsonl')), 'jsonl harus tetap di tempat');
  assert.equal(latestHistoryDir(dir), path.join(dir, 'history', r.folder));
  assert.equal(archivePreviousRun(dir).archived, false, 'folder kosong tidak diarsipkan lagi');
});

test('perbandingan: risiko turun + cakupan naik -> PERBAIKAN_KONSISTEN dengan delta eksak', () => {
  const dir = mkTmp();
  const prevDir = path.join(dir, 'history', '2026-10-20T16-09-51-107Z');
  fs.mkdirSync(prevDir, { recursive: true });
  fakeRun(prevDir, { at: '2026-10-20T16:30:00Z', score: 60, scoreNoDb: 60, conf: 68, evalPct: 77.78, riskDim: 0, retention: 0.19, rules: ruleset(9, 5, 4), matches: [{ database: { total_database_weight: 5 } }, { database: { total_database_weight: -9 } }], scanned: 98, complete: 16, pools: ['A', 'B', 'C'] });
  fakeRun(dir, { at: '2026-10-21T05:30:00Z', score: 63, scoreNoDb: 63, conf: 68.7, evalPct: 88.89, riskDim: 9, retention: 0.15, rules: ruleset(8, 8, 2), matches: [{ database: { total_database_weight: 5 } }], scanned: 100, complete: 8, pools: ['A', 'B', 'D'] });
  const cmp = buildComparison(dir);
  assert.equal(cmp.marker.code, 'PERBAIKAN_KONSISTEN');
  assert.equal(cmp.delta.score, 3);
  assert.equal(cmp.delta.triggered, -1);
  assert.equal(cmp.delta.insufficient, -2);
  assert.equal(cmp.delta.db_total_weight, 9); // (-4) -> (+5)
  assert.equal(cmp.delta.db_matched, -1);
  assert.equal(cmp.pool_changes.common, 2);
  assert.deepEqual(cmp.pool_changes.added, ['D']);
  assert.deepEqual(cmp.pool_changes.removed, ['C']);
  assert.equal(cmp.rule_changes.length, 3); // R-09 T->NT, R-15 & R-16 I->NT
  assert.ok(cmp.rule_changes.some(c => c.rule === 'R-09' && c.from === 'TRIGGERED' && c.to === 'NOT_TRIGGERED'));
});

test('perbandingan: risiko turun + cakupan turun -> KEMUNGKINAN_ARTEFAK_SEPI', () => {
  const dir = mkTmp();
  const prevDir = path.join(dir, 'history', '2026-10-20T16-09-51-107Z');
  fs.mkdirSync(prevDir, { recursive: true });
  fakeRun(prevDir, { at: '2026-10-20T16:30:00Z', score: 60, scoreNoDb: 60, conf: 68, evalPct: 88.89, riskDim: 20, retention: 0.2, rules: ruleset(5, 11, 2), matches: [], scanned: 100, complete: 16, pools: ['A'] });
  fakeRun(dir, { at: '2026-10-21T05:30:00Z', score: 66, scoreNoDb: 66, conf: 60, evalPct: 55.56, riskDim: 40, retention: 0.2, rules: ruleset(3, 9, 6), matches: [], scanned: 90, complete: 4, pools: ['A'] });
  const cmp = buildComparison(dir);
  assert.equal(cmp.marker.code, 'KEMUNGKINAN_ARTEFAK_SEPI');
});

test('perbandingan: tanpa arsip -> null (report tidak menampilkan section)', () => {
  const dir = mkTmp();
  fakeRun(dir, { at: '2026-10-21T05:30:00Z', score: 60, scoreNoDb: 60, conf: 60, evalPct: 80, riskDim: 10, retention: 0.1, rules: ruleset(1, 15, 2), matches: [], scanned: 100, complete: 10, pools: ['A'] });
  assert.equal(buildComparison(dir), null);
});
