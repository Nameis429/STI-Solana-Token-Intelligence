'use strict';
/* Ronde 25 (kalibrasi P5 final 2026-10-27, otorisasi bersyarat Rin 2026-10-25):
 * Hitung ulang atas 22 label formal 7 hari Batch 1 (13 buruk STRICT, 9 baik):
 * - C1 SPR-02 T=30: presisi 0,786 (11/14), recall 1,00 (11/11 buruk terevaluasi)
 *   -> LOLOS gerbang (presisi >=0,60 & recall >=0,85). min_count 5 -> 30.
 * - C2 CTR-02 T=10: presisi 0,733 (11/15), recall 1,00 (11/11 buruk terevaluasi)
 *   -> LOLOS gerbang. CTR-02 dulunya biner tanpa threshold numerik; kini
 *   TRIGGERED hanya bila qualifying_sequences >= 10, plus disclaimer
 *   "CTR-02 padam ≠ aman" (pelajaran LouLou: CTR-02 NOT_TRIGGERED tetapi
 *   outcome formal 7 hari buruk, HIDUP rel_sol -86,8%).
 * - C3 CTR-03 & C4 bobot Phase 11 TIDAK diubah (sesuai rekomendasi yang
 *   diterima); guardrail dimensi-hilang tetap rancangan, bukan implementasi.
 * Catatan ambang: 2 buruk tak terevaluasi per rule tetap lolos dari kedua
 * sinyal (C1: LouLou INSUFFICIENT_DATA, KWIF PROVISIONAL; C2: LouLou
 * NOT_TRIGGERED, hi INSUFFICIENT_DATA) — recall gerbang dihitung di antara
 * buruk yang terevaluasi, seperti dossier 2026-10-25. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const p11 = require(path.join(root, 'Script/phase11_final_report.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const R = rules.categories;
const spr02Rule = R.SELL_PRESSURE_RISK
  ? R.SELL_PRESSURE_RISK.rules['SPR-02']
  : Object.values(R).flatMap(g => Object.values(g.rules || {})).find(r => r && r.evaluator === 'SPR-02');
const ctr02Rule = R.COORDINATED_TRADING_RISK.rules['CTR-02'];

// ---------- C1: nilai konfigurasi terkunci ----------

test('C1: SPR-02 min_count terkunci 30 (kalibrasi P5 final)', () => {
  assert.equal(spr02Rule.min_count, 30);
});

function spr02Sells(wallet, count) {
  return Array.from({ length: count }, (_, i) => ({
    wallet, mint: 'MINT',
    event: { event_class: 'SELL', signature: `spr25-${i}`, block_time: 1700000000 + i * 10 },
  }));
}

test('C1: SPR-02 TRIGGERED pada 30 SELL unik dalam 1 jam, PROVISIONAL pada 29', () => {
  const w = 'WalletSPR25AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const phase8 = { wallets: [{ wallet: w, history: { complete: true, events: [] } }] };
  const r30 = p9.evaluateRule('SPR-02', 'SELL_PRESSURE_RISK', spr02Rule,
    { events: spr02Sells(w, 30), phase8, phase4: {}, rules });
  assert.equal(r30.status, 'TRIGGERED');
  const r29 = p9.evaluateRule('SPR-02', 'SELL_PRESSURE_RISK', spr02Rule,
    { events: spr02Sells(w, 29), phase8, phase4: {}, rules });
  assert.equal(r29.status, 'PROVISIONAL', '29 < ambang primer 30 tetapi >= ambang alternatif 3');
});

// ---------- C2: threshold count 10 ----------

test('C2: CTR-02 min_count terkunci 10 di konfigurasi', () => {
  assert.equal(ctr02Rule.min_count, 10);
});

function ctr02Fixture(n) {
  const w = 'WalletCTR25AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const wallet = {
    wallet: w, current: { balance_raw: '500' },
    history: {
      complete: true,
      events: [{ event_class: 'BUY', block_time: 1700003600, signature: 'sigTrade25' }],
    },
  };
  const funders = Array.from({ length: n }, (_, i) => ({
    funder: `Funder25${String(i).padStart(2, '0')}AAAAAAAAAAAAAAAAAAAAA`,
    asset: 'SOL', amount_raw: '1000000', signature: `sigFund25-${i}`, block_time: 1700000000,
  }));
  const fg = { shared_funders: [], wallets: { [w]: { funders } } };
  return { phase8: { wallets: [wallet] }, fundingGraph: fg, rules };
}

test('C2: CTR-02 TRIGGERED pada 10 sequence, NOT_TRIGGERED pada 9 dan 1', () => {
  const r10 = p9.evaluateRule('CTR-02', 'COORDINATED_TRADING_RISK', ctr02Rule, ctr02Fixture(10));
  assert.equal(r10.status, 'TRIGGERED');
  assert.equal(r10.metric.qualifying_sequences, 10);
  assert.equal(r10.metric.min_count_threshold, 10);
  for (const n of [9, 1]) {
    const r = p9.evaluateRule('CTR-02', 'COORDINATED_TRADING_RISK', ctr02Rule, ctr02Fixture(n));
    assert.equal(r.status, 'NOT_TRIGGERED', `${n} sequence harus di bawah ambang 10`);
    assert.match(r.reason, /CTR-02 padam/);
    assert.match(r.reason, /di bawah ambang|below threshold/);
  }
});

// ---------- C2: disclaimer di limitations Phase 11 ----------

function syntheticPhases(ctr02Status) {
  const dbWallet = (wallet, sellAt) => ({
    wallet,
    database: { matched: true, name: wallet, roles: ['DEFAULT'], role_weight: 1, modifier_weight: 0, total_database_weight: 1 },
    current: { is_holder: false, supply_percentage: 0.01 },
    history: { events: [
      { event_class: 'BUY', block_time: sellAt - 600 },
      { event_class: 'SELL', block_time: sellAt },
    ] },
  });
  const rulesList = [
    { rule_id: 'CTR-02', status: ctr02Status },
    ...Array.from({ length: 4 }, (_, i) => ({ rule_id: `I-${i}`, status: 'INSUFFICIENT_DATA' })),
    ...Array.from({ length: 13 }, (_, i) => ({ rule_id: `N-${i}`, status: 'NOT_TRIGGERED' })),
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
    9: { status: 'COMPLETE', summary: { rules_total: 18, triggered: 0, provisional: 0, not_triggered: 14 }, rules: rulesList },
    10: { status: 'COMPLETE', summary: {}, evidence_groups: [{ category: 'X', risk: { score: 50 }, evidence_strength: { score: 80 } }] },
  };
}

test('C2: limitations Phase 11 memuat disclaimer saat CTR-02 NOT_TRIGGERED, tidak saat TRIGGERED', () => {
  const off = p11.buildReport(syntheticPhases('NOT_TRIGGERED'), 'SYNTH');
  assert.ok(off.limitations.some(x => x.includes('CTR-02 padam')), 'disclaimer harus ada saat CTR-02 padam');
  assert.ok(off.limitations.some(x => x.includes('LouLou')), 'disclaimer harus menyebut pelajaran LouLou');
  const on = p11.buildReport(syntheticPhases('TRIGGERED'), 'SYNTH');
  assert.ok(!on.limitations.some(x => x.includes('CTR-02 padam')), 'disclaimer tidak boleh muncul saat CTR-02 menyala');
});
