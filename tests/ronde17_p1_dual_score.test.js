'use strict';
/* Ronde 17 (P1 roadmap): skor ganda dengan/tanpa DB + deklarasi
 * eksplisit fee_utility.
 * - Skor resmi TIDAK berubah (formula Phase 11 terkunci); varian tanpa
 *   DB dihitung dari pre_db_score per dimensi (eksak, bukan rekonstruksi).
 * - fee_utility: penelusuran membuktikan BUKAN bug wiring — Phase 6
 *   menghasilkan skor, Phase 11 memasang gerbang project_utility_verified
 *   yang praktis tak terpenuhi untuk token pump.fun (23/23 scan).
 *   P1 menyelesaikannya sebagai DEKLARASI eksplitik, bukan aktivasi
 *   diam-diam (aktivasi = perubahan model = wilayah P5, keputusan Rin). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const p11 = require(path.join(root, 'Script/phase11_final_report.js'));
const html = require(path.join(root, 'Script/generate_html_report.js'));

function syntheticPhases() {
  const dbWallet = (wallet, sellAt) => ({
    wallet,
    database: { matched: true, name: wallet, roles: ['DEFAULT'], role_weight: 1, modifier_weight: 0, total_database_weight: 1 },
    current: { is_holder: false, supply_percentage: 0.01 },
    history: { events: [
      { event_class: 'BUY', block_time: sellAt - 600 },
      { event_class: 'SELL', block_time: sellAt },
    ] },
  });
  const rules = [
    ...Array.from({ length: 4 }, (_, i) => ({ rule_id: `I-${i}`, status: 'INSUFFICIENT_DATA' })),
    ...Array.from({ length: 14 }, (_, i) => ({ rule_id: `N-${i}`, status: 'NOT_TRIGGERED' })),
  ];
  return {
    2: { status: 'COMPLETE', authority: { mint: { status: 'REVOKED' }, freeze: { status: 'REVOKED' } } },
    4: { status: 'COMPLETE', concentration: { adjusted_confirmed_normal: { top_10: { share_of_total_supply_pct: 10 } } } },
    5: { status: 'COMPLETE', creator_events: { sell: { status: 'NO_SELL_OBSERVED_WITHIN_COVERAGE', sell_count: 0 } } },
    6: { status: 'SAMPLED', fee_economic_assessment: {
      classification: 'FEE_ROUTING_ONLY_PURPOSE_UNKNOWN', score: 0, confidence: 'MEDIUM',
      project_utility_verified: false, project_utility_evidence_status: 'OBSERVED',
      buyback_burn_verified: false, creator_extraction_verified: false, holder_benefit_verified: false,
    } },
    7: { status: 'COMPLETE', matches: [] },
    8: { status: 'PARTIAL', summary: { wallets_scanned: 3, complete_histories: 3 }, wallets: [dbWallet('W1', 1600), dbWallet('W2', 1700), dbWallet('W3', 1800)] },
    9: { status: 'COMPLETE', summary: { rules_total: 18, triggered: 0, provisional: 0, not_triggered: 14 }, rules },
    10: { status: 'COMPLETE', summary: {}, evidence_groups: [{ category: 'X', risk: { score: 50 }, evidence_strength: { score: 80 } }] },
  };
}

test('skor ganda: adjustment DB negatif tercatat eksak — tanpa DB lebih tinggi, delta konsisten', () => {
  const r = p11.buildReport(syntheticPhases(), 'SYNTH');
  const v = r.summary.score_variants;
  assert.ok(v, 'score_variants harus ada');
  // risk_findings: basis 50, adj DB ter-clamp -15 -> 35.
  const risk = r.score_breakdown.find(d => d.id === 'risk_findings');
  assert.equal(risk.details.pre_db_score, 50);
  assert.equal(risk.score, 35);
  assert.equal(risk.details.db_adjustment.total_points, -15);
  // with_db: (100*20 + 90*20 + 65*15 + 35*25)/80 = 70.625 -> 71
  // without_db: (100*20 + 90*20 + 65*15 + 50*25)/80 = 75.3125 -> 75
  assert.equal(v.with_db.score, 71);
  assert.equal(v.without_db.score, 75);
  assert.equal(v.with_db.score, r.summary.final_quality_score, 'skor resmi tidak berubah');
  assert.equal(v.db_delta_points, -4);
  assert.equal(v.db_delta_points, v.with_db.score - v.without_db.score);
});

test('fee_utility: dinyatakan TIDAK DIPAKAI dengan bukti Phase 6 tercatat (bukan hilang diam-diam)', () => {
  const r = p11.buildReport(syntheticPhases(), 'SYNTH');
  const f = r.summary.fee_utility_status;
  assert.ok(f, 'fee_utility_status harus ada');
  assert.equal(f.status, 'NOT_USED');
  assert.equal(f.used_in_score, false);
  assert.equal(f.classification, 'FEE_ROUTING_ONLY_PURPOSE_UNKNOWN');
  assert.equal(f.source_score, 0);
  assert.equal(f.buyback_burn_verified, false); // fixture ronde 17: TANPA bukti terverifikasi -> deklarasi NOT_USED (kasus M2 aktif di test ronde 19)
  const feeDim = r.score_breakdown.find(d => d.id === 'fee_utility');
  assert.equal(feeDim.available, false);
  assert.match(feeDim.reason, /TIDAK DIPAKAI/);
  assert.ok(r.limitations.some(x => x.includes('fee_utility TIDAK DIPAKAI')), 'limitations harus menyebut fee_utility');
});

test('buildReport 8DXq: skor terkunci 53 utuh; varian & status fee tersedia', () => {
  const dir = path.join(root, 'Output', '8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq');
  const p = {};
  for (let i = 1; i <= 10; i++) {
    const f = path.join(dir, `phase${i}-result.json`);
    p[i] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  }
  const r = p11.buildReport(p, '8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq');
  assert.equal(r.summary.final_quality_score, 53);
  const v = r.summary.score_variants;
  assert.equal(v.with_db.score, 53);
  assert.equal(typeof v.without_db.score, 'number');
  assert.equal(v.db_delta_points, v.with_db.score - v.without_db.score);
  assert.ok(r.summary.fee_utility_status, 'fee_utility_status harus ada pada fixture nyata');
});

test('renderScoreHeader: varian tanpa DB + fee terbaca; report lama tetap aman', () => {
  const fake = {
    summary: {
      final_quality_score: 60, classification: { tier: 3, label: 'Sedang' },
      confidence: { level: 'MEDIUM', score: 67.97 }, coverage: { phase9_rule_evaluated_pct: 77.78 },
      score_gate: { provisional: false, reasons: [] },
      score_variants: { with_db: { score: 60 }, without_db: { score: 63, classification: { tier: 3, label: 'Sedang' } }, db_delta_points: -3 },
      fee_utility_status: { status: 'NOT_USED', classification: 'FEE_ROUTING_ONLY_PURPOSE_UNKNOWN', source_score: 0 },
    },
    final_report: { headline: 'Sedang — 60/100' },
  };
  const h = html.renderScoreHeader(fake);
  assert.equal(h.withoutDbScore, 63);
  assert.equal(h.dbDelta, -3);
  assert.equal(h.feeNotUsed, true);
  assert.equal(h.feeClassification, 'FEE_ROUTING_ONLY_PURPOSE_UNKNOWN');
  const old = { summary: { final_quality_score: 53, classification: { tier: 3, label: 'Sedang' }, confidence: { level: 'MEDIUM', score: 74.82 }, coverage: { phase9_rule_evaluated_pct: 22.22 } } };
  const h2 = html.renderScoreHeader(old);
  assert.equal(h2.withoutDbScore, null);
  assert.equal(h2.feeNotUsed, false);
});
