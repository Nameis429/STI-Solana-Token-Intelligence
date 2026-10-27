'use strict';
/* Ronde 19 (P1 ditutup — keputusan Rin 2026-10-21): fee_utility
 * DIAKTIFKAN dengan model M2.
 * - Eligibility: >=1 bukti penggunaan fee terverifikasi (utilitas
 *   protokol / manfaat holder / buyback-burn / ekstraksi creator)
 *   + skor sumber Phase 6 tersedia.
 * - Pemetaan NETRAL: dimensi = clamp(50 + 5 x skor), skor -10..10.
 * - Tanpa bukti terverifikasi: dimensi tetap TIDAK DIPAKAI (deklarasi
 *   Ronde 17) — aktivasi tidak memaksa skor untuk data kosong.
 * Bukti simulasi pra-aktivasi (23 scan): gerbang lama meloloskan 0/23;
 * M2 menggeser 5 skor sebesar -1..-2 poin (model x10 menghukum -6..-8
 * hanya karena bukti absen — ditolak). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const p11 = require(path.join(root, 'Script/phase11_final_report.js'));

function phasesWithFee(feeAssessment) {
  const rules = [
    ...Array.from({ length: 4 }, (_, i) => ({ rule_id: `I-${i}`, status: 'INSUFFICIENT_DATA' })),
    ...Array.from({ length: 14 }, (_, i) => ({ rule_id: `N-${i}`, status: 'NOT_TRIGGERED' })),
  ];
  return {
    2: { status: 'COMPLETE', authority: { mint: { status: 'REVOKED' }, freeze: { status: 'REVOKED' } } },
    4: { status: 'COMPLETE', concentration: { adjusted_confirmed_normal: { top_10: { share_of_total_supply_pct: 10 } } } },
    5: { status: 'COMPLETE', creator_events: { sell: { status: 'NO_SELL_OBSERVED_WITHIN_COVERAGE', sell_count: 0 } } },
    6: { status: 'SAMPLED', fee_economic_assessment: feeAssessment },
    9: { status: 'COMPLETE', summary: { rules_total: 18, triggered: 0, provisional: 0, not_triggered: 14 }, rules },
    10: { status: 'COMPLETE', summary: {}, evidence_groups: [{ category: 'X', risk: { score: 50 }, evidence_strength: { score: 80 } }] },
  };
}
const feeDim = r => r.score_breakdown.find(d => d.id === 'fee_utility');

test('M2: buyback/burn terverifikasi + skor 0 -> dimensi netral 50, status USED', () => {
  const r = p11.buildReport(phasesWithFee({
    classification: 'FEE_ROUTING_ONLY_PURPOSE_UNKNOWN', score: 0, confidence: 'MEDIUM',
    project_utility_verified: false, project_utility_evidence_status: 'OBSERVED',
    buyback_burn_verified: true, creator_extraction_verified: false, holder_benefit_verified: false,
  }), 'M2A');
  assert.equal(feeDim(r).available, true);
  assert.equal(feeDim(r).score, 50);
  assert.equal(feeDim(r).details.model, 'M2_NEUTRAL_50_PLUS_5X');
  assert.equal(feeDim(r).details.eligibility_status, 'ELIGIBLE_M2');
  assert.equal(r.summary.fee_utility_status.status, 'USED');
  assert.equal(r.summary.fee_utility_status.model, 'M2_NEUTRAL_50_PLUS_5X');
  assert.deepEqual(Object.keys(r.summary.fee_utility_status.verified_uses).filter(k => r.summary.fee_utility_status.verified_uses[k]), ['buyback_burn']);
  // Skor akhir: (100*20+90*20+65*15+50*25+50*10)/90 = 6525/90 = 72.5 -> 73
  assert.equal(r.summary.final_quality_score, 73);
});

test('M2: ekstraksi creator terverifikasi + skor -4 -> dimensi 30 (sinyal negatif masuk, terpetakan netral)', () => {
  const r = p11.buildReport(phasesWithFee({
    classification: 'CREATOR_EXTRACTION_VERIFIED', score: -4, confidence: 'MEDIUM',
    project_utility_verified: false, project_utility_evidence_status: 'OBSERVED',
    buyback_burn_verified: false, creator_extraction_verified: true, holder_benefit_verified: false,
  }), 'M2B');
  assert.equal(feeDim(r).available, true);
  assert.equal(feeDim(r).score, 30);
});

test('M2: utilitas proyek + skor +6 -> dimensi 80 (bukan 60 ala peta x10 lama)', () => {
  const r = p11.buildReport(phasesWithFee({
    classification: 'PROJECT_UTILITY_VERIFIED', score: 6, confidence: 'HIGH',
    project_utility_verified: true, project_utility_evidence_status: 'VERIFIED',
    buyback_burn_verified: false, creator_extraction_verified: false, holder_benefit_verified: true,
  }), 'M2C');
  assert.equal(feeDim(r).available, true);
  assert.equal(feeDim(r).score, 80);
});

test('M2: tanpa bukti terverifikasi -> dimensi tetap tidak dipakai (deklarasi dipertahankan)', () => {
  const r = p11.buildReport(phasesWithFee({
    classification: 'FEE_ROUTING_ONLY_PURPOSE_UNKNOWN', score: 0, confidence: 'LOW',
    project_utility_verified: false, project_utility_evidence_status: 'OBSERVED',
    buyback_burn_verified: false, creator_extraction_verified: false, holder_benefit_verified: false,
  }), 'M2D');
  assert.equal(feeDim(r).available, false);
  assert.equal(r.summary.fee_utility_status.status, 'NOT_USED');
  assert.equal(r.summary.fee_utility_status.model, null);
});
