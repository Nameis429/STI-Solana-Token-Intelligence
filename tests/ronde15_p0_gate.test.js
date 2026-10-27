'use strict';
/* Ronde 15 (P0 roadmap): gerbang cakupan Phase 11.
 * Formula skor TIDAK berubah — gerbang hanya membatasi KLAIM klasifikasi:
 * risk_findings tidak tersedia ATAU rasio INSUFFICIENT_DATA > 1/3
 * -> skor PROVISIONAL + tier diplafon ke 3. Bukti pemicu: batch 1
 * realtime scan (korelasi INSUFFICIENT vs skor +0,65; LouLou 81 dari
 * data paling rusak). Keputusan Rin 2026-10-20. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const p11 = require(path.join(root, 'Script/phase11_final_report.js'));
const html = require(path.join(root, 'Script/generate_html_report.js'));

const tier5 = p11.tierFor(81);
const tier4 = p11.tierFor(65);

test('gate: kasus LouLou — risk unavailable + INSUFFICIENT tinggi -> PROVISIONAL, tier 5 diplafon ke 3', () => {
  const g = p11.evaluateScoreGate({ tier: tier5, riskAvailable: false, insufficientCount: 11, ruleTotal: 18 });
  assert.equal(g.applied, true);
  assert.equal(g.provisional, true);
  assert.deepEqual(g.reasons, ['risk_findings_unavailable', 'insufficient_ratio_above_threshold']);
  assert.equal(g.classification_before_gate.tier, 5);
  assert.equal(g.classification_after_gate.tier, 3);
  assert.equal(g.classification_after_gate.label, 'Sedang');
  assert.equal(g.insufficient_ratio, 0.6111);
});

test('gate: sehat — risk tersedia + INSUFFICIENT di bawah ambang -> tidak diterapkan', () => {
  const g = p11.evaluateScoreGate({ tier: tier4, riskAvailable: true, insufficientCount: 4, ruleTotal: 18 });
  assert.equal(g.applied, false);
  assert.equal(g.provisional, false);
  assert.equal(g.classification_after_gate.tier, 4);
});

test('gate: tepi ambang — tepat 1/3 (6/18) TIDAK kena, 7/18 kena', () => {
  const at = p11.evaluateScoreGate({ tier: tier4, riskAvailable: true, insufficientCount: 6, ruleTotal: 18 });
  assert.equal(at.applied, false);
  const over = p11.evaluateScoreGate({ tier: tier4, riskAvailable: true, insufficientCount: 7, ruleTotal: 18 });
  assert.equal(over.applied, true);
  assert.deepEqual(over.reasons, ['insufficient_ratio_above_threshold']);
});

test('gate: risk unavailable saja (INSUFFICIENT nol) tetap kena', () => {
  const g = p11.evaluateScoreGate({ tier: tier4, riskAvailable: false, insufficientCount: 0, ruleTotal: 18 });
  assert.equal(g.applied, true);
  assert.deepEqual(g.reasons, ['risk_findings_unavailable']);
});

test('gate: dimatikan via config -> tidak pernah diterapkan', () => {
  const g = p11.evaluateScoreGate(
    { tier: tier5, riskAvailable: false, insufficientCount: 18, ruleTotal: 18 },
    { enabled: false });
  assert.equal(g.enabled, false);
  assert.equal(g.applied, false);
  assert.equal(g.classification_after_gate.tier, 5);
});

test('gate: tier tidak tersedia (skor null) -> tidak diterapkan, tidak crash', () => {
  const g = p11.evaluateScoreGate({ tier: { tier: null, label: 'Tidak tersedia' }, riskAvailable: false, insufficientCount: null, ruleTotal: null });
  assert.equal(g.applied, false);
  assert.equal(g.insufficient_ratio, null);
});

test('gate: config tidak valid jatuh ke bawaan (1/3, cap 3)', () => {
  const cfg = p11.resolveScoreGateConfig({ max_insufficient_ratio: 7, tier_cap: 99 });
  assert.equal(cfg.max_insufficient_ratio, 1 / 3);
  assert.equal(cfg.tier_cap, 3);
  const cfg2 = p11.resolveScoreGateConfig({ max_insufficient_ratio: 0.5, tier_cap: 2 });
  assert.equal(cfg2.max_insufficient_ratio, 0.5);
  assert.equal(cfg2.tier_cap, 2);
});

test('buildReport 8DXq: skor terkunci 53 tidak berubah; gate tercatat jujur (14/18 INSUFFICIENT)', () => {
  const dir = path.join(root, 'Output', '8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq');
  const p = {};
  for (let i = 1; i <= 10; i++) p[i] = JSON.parse(fs.readFileSync(path.join(dir, `phase${i}-result.json`), 'utf8'));
  const r = p11.buildReport(p, '8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq');
  assert.equal(r.summary.final_quality_score, 53); // formula terkunci utuh
  assert.equal(r.summary.score_gate.insufficient_rules, 14);
  assert.equal(r.summary.score_gate.applied, true);
  assert.equal(r.summary.classification.tier, 3); // sudah di plafon — tidak bergeser
});

test('buildReport LouLou-style (sintetis): skor mentah tinggi tetap tampil, tier diplafon + PROVISIONAL', () => {
  // Dimensi kuat tanpa bukti risiko: p10 tanpa evidence group berisiko numerik
  // -> risk_findings unavailable; phase 9 didominasi INSUFFICIENT_DATA.
  const rules = [
    ...Array.from({ length: 11 }, (_, i) => ({ rule_id: `X-${i}`, status: 'INSUFFICIENT_DATA' })),
    ...Array.from({ length: 7 }, (_, i) => ({ rule_id: `Y-${i}`, status: 'NOT_TRIGGERED' })),
  ];
  const p = {
    2: { status: 'COMPLETE', authority: { mint_authority: 'REVOKED', freeze_authority: 'REVOKED' } },
    9: { status: 'COMPLETE', summary: { rules_total: 18, triggered: 0, provisional: 0, not_triggered: 7 }, rules },
    10: { status: 'COMPLETE', summary: {}, evidence_groups: [] },
  };
  const r = p11.buildReport(p, 'SYNTH');
  const g = r.summary.score_gate;
  assert.equal(g.risk_findings_available, false);
  assert.ok(g.reasons.includes('risk_findings_unavailable'));
  assert.ok(g.reasons.includes('insufficient_ratio_above_threshold'));
  assert.equal(g.applied, true);
  assert.ok(r.summary.classification.tier <= 3, 'tier harus diplafon');
  assert.ok(r.final_report.headline.startsWith('PROVISIONAL'));
  assert.equal(typeof r.summary.final_quality_score, 'number'); // angka mentah tetap ada
});

test('renderScoreHeader: tigaan headline + status provisional terbaca dari summary', () => {
  const fake = {
    summary: {
      final_quality_score: 81,
      classification: { tier: 3, label: 'Sedang' },
      confidence: { level: 'LOW', score: 40.28 },
      coverage: { phase9_rule_evaluated_pct: 38.89 },
      score_gate: { provisional: true, tier_cap: 3, reasons: ['risk_findings_unavailable'] },
    },
    final_report: { headline: 'PROVISIONAL — Sedang — 81/100' },
  };
  const h = html.renderScoreHeader(fake);
  assert.equal(h.score, 81);
  assert.equal(h.confidenceScore, 40.28);
  assert.equal(h.ruleEvaluatedPct, 38.89);
  assert.equal(h.provisional, true);
  assert.deepEqual(h.gateReasons, ['risk_findings_unavailable']);
});

test('renderScoreHeader: report lama tanpa score_gate tetap aman (tidak provisional)', () => {
  const fake = {
    summary: {
      final_quality_score: 53,
      classification: { tier: 3, label: 'Sedang' },
      confidence: { level: 'MEDIUM', score: 74.82 },
      coverage: { phase9_rule_evaluated_pct: 22.22 },
    },
  };
  const h = html.renderScoreHeader(fake);
  assert.equal(h.provisional, false);
  assert.equal(h.ruleEvaluatedPct, 22.22);
});
