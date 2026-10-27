'use strict';
/* Ronde 26 (mekanisme rezim dini, otorisasi Rin 2026-10-27, skala MENIT):
 * - Umur token dalam MENIT: scan start (scan-context rescanned_at ||
 *   started_at) minus event Phase 8 tertua (proksi peluncuran).
 * - Rezim dini: age_minutes <= settings.early_regime.age_minutes_max (1440).
 * - Slot rule.early_regime.min_count: null = WARISI threshold matang — perilaku
 *   hari ini TIDAK berubah (SPR-02 tetap 30, CTR-02 tetap 10); angka dini
 *   diisi nanti dari kohort dini lewat konfigurasi saja.
 * - CTR-02: window lag TIDAK dipangkas umur (funding bisa mendahului token);
 *   yang ditambah adalah slot min_count dini + laporan lag dalam menit.
 * - Phase 11: limitations menandai rezim dini + sifat sementara threshold. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const p11 = require(path.join(root, 'Script/phase11_final_report.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const R = rules.categories;
const spr02Rule = Object.values(R).flatMap(g => Object.values(g.rules || {})).find(r => r && r.evaluator === 'SPR-02');
const ctr02Rule = R.COORDINATED_TRADING_RISK.rules['CTR-02'];

const START = '2026-10-27T08:00:00.000Z';
const START_SEC = Date.parse(START) / 1000;
const ev = (blockTime, cls = 'SELL', sig = 'sig') => ({ event: { event_class: cls, block_time: blockTime, signature: sig } });

// ---------- Konfigurasi ----------

test('R26: batas rezim dini 1440 menit di settings, slot dini null (warisi matang)', () => {
  assert.equal(rules.settings.early_regime.age_minutes_max, 1440);
  assert.equal(spr02Rule.min_count, 30);
  assert.equal(spr02Rule.early_regime.min_count, null);
  assert.equal(ctr02Rule.min_count, 10);
  assert.equal(ctr02Rule.early_regime.min_count, null);
});

// ---------- computeTokenAge (menit) ----------

test('R26: umur 90 menit = early; 1440 menit = early (batas inklusif); 1440,5 menit = mature', () => {
  const at = minutes => p9.computeTokenAge({
    events: [ev(START_SEC - minutes * 60)], scanStartIso: START, rules,
  });
  const e90 = at(90);
  assert.equal(e90.regime, 'early');
  assert.equal(e90.age_minutes, 90);
  assert.equal(e90.birth_source, 'earliest_phase8_event');
  assert.equal(at(1440).regime, 'early');
  assert.equal(at(1440).age_minutes, 1440);
  assert.equal(at(1440.5).regime, 'mature');
});

test('R26: tanpa event / tanpa waktu scan = unknown (threshold matang berlaku)', () => {
  assert.equal(p9.computeTokenAge({ events: [], scanStartIso: START, rules }).regime, 'unknown');
  assert.equal(p9.computeTokenAge({ events: [ev(START_SEC)], scanStartIso: null, rules }).regime, 'unknown');
  const age = p9.computeTokenAge({ events: [ev(START_SEC)], scanStartIso: null, rules });
  assert.equal(age.age_minutes, null);
});

test('R26: batas kustom dari settings dihormati', () => {
  const custom = { settings: { early_regime: { age_minutes_max: 60 } } };
  const age = p9.computeTokenAge({ events: [ev(START_SEC - 90 * 60)], scanStartIso: START, rules: custom });
  assert.equal(age.regime, 'mature');
  assert.equal(age.age_minutes_max, 60);
});

// ---------- effectiveMinCount ----------

test('R26: early + slot dini terisi = pakai slot; early + null = warisi matang; mature/unknown = matang', () => {
  const early = { regime: 'early', age_minutes: 90 };
  const mature = { regime: 'mature', age_minutes: 3000 };
  assert.equal(p9.effectiveMinCount({ min_count: 30, early_regime: { min_count: 5 } }, early, 5), 5);
  assert.equal(p9.effectiveMinCount({ min_count: 30, early_regime: { min_count: null } }, early, 5), 30);
  assert.equal(p9.effectiveMinCount({ min_count: 30, early_regime: { min_count: 5 } }, mature, 5), 30);
  assert.equal(p9.effectiveMinCount({ min_count: 30 }, undefined, 5), 30);
});

// ---------- SPR-02: override dini vs warisan ----------

function spr02Sells(wallet, count, base) {
  return Array.from({ length: count }, (_, i) => ({
    wallet, mint: 'MINT',
    event: { event_class: 'SELL', signature: `spr26-${i}`, block_time: base + i * 10 },
  }));
}

test('R26: SPR-02 rezim dini dengan slot 5: 5 SELL = TRIGGERED + threshold_applied 5 + umur menit', () => {
  const w = 'WalletSPR26AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const rule = { ...spr02Rule, early_regime: { min_count: 5 } };
  const ageInfo = { regime: 'early', age_minutes: 90, birth_source: 'earliest_phase8_event' };
  const phase8 = { wallets: [{ wallet: w, history: { complete: true, events: [] } }] };
  const r = p9.evaluateRule('SPR-02', 'SELL_PRESSURE_RISK', rule,
    { events: spr02Sells(w, 5, START_SEC - 3600), phase8, phase4: {}, rules, ageInfo });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.threshold_applied, 5);
  assert.equal(r.metric.regime, 'early');
  assert.equal(r.metric.age_minutes, 90);
});

test('R26: SPR-02 rezim dini dengan slot null: 5 SELL = PROVISIONAL (warisi matang 30 + alternatif 3)', () => {
  const w = 'WalletSPR26AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ageInfo = { regime: 'early', age_minutes: 90, birth_source: 'earliest_phase8_event' };
  const phase8 = { wallets: [{ wallet: w, history: { complete: true, events: [] } }] };
  const r = p9.evaluateRule('SPR-02', 'SELL_PRESSURE_RISK', spr02Rule,
    { events: spr02Sells(w, 5, START_SEC - 3600), phase8, phase4: {}, rules, ageInfo });
  assert.equal(r.status, 'PROVISIONAL');
  assert.equal(r.metric.threshold_applied, 30);
});

// ---------- CTR-02: override dini + lag menit ----------

function ctr02Fixture(n, ageInfo) {
  const w = 'WalletCTR26AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const wallet = {
    wallet: w, current: { balance_raw: '500' },
    history: {
      complete: true,
      events: [{ event_class: 'BUY', block_time: 1700003600, signature: 'sigTrade26' }],
    },
  };
  const funders = Array.from({ length: n }, (_, i) => ({
    funder: `Funder26${String(i).padStart(2, '0')}AAAAAAAAAAAAAAAAAAAAA`,
    asset: 'SOL', amount_raw: '1000000', signature: `sigFund26-${i}`, block_time: 1700000000,
  }));
  return { phase8: { wallets: [wallet] }, fundingGraph: { shared_funders: [], wallets: { [w]: { funders } } }, rules, ageInfo };
}

test('R26: CTR-02 rezim dini dengan slot 3: 3 sequence = TRIGGERED + lag 60 menit dilaporkan', () => {
  const rule = { ...ctr02Rule, early_regime: { min_count: 3 } };
  const ageInfo = { regime: 'early', age_minutes: 120, birth_source: 'earliest_phase8_event' };
  const r = p9.evaluateRule('CTR-02', 'COORDINATED_TRADING_RISK', rule, ctr02Fixture(3, ageInfo));
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.threshold_applied, 3);
  assert.equal(r.metric.regime, 'early');
  assert.equal(r.metric.lag_minutes.min, 60);
  assert.equal(r.metric.lag_minutes.median, 60);
  assert.equal(r.metric.lag_minutes.max, 60);
});

test('R26: CTR-02 rezim dini dengan slot null: 3 sequence = NOT_TRIGGERED (warisi matang 10)', () => {
  const ageInfo = { regime: 'early', age_minutes: 120, birth_source: 'earliest_phase8_event' };
  const r = p9.evaluateRule('CTR-02', 'COORDINATED_TRADING_RISK', ctr02Rule, ctr02Fixture(3, ageInfo));
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.equal(r.metric.threshold_applied, 10);
});

// ---------- runEvaluation tanpa scan-context ----------

test('R26: runEvaluation tanpa Output/scan-context tidak crash; token_age unknown', () => {
  const out = p9.runEvaluation({ rules, phase8: { wallets: [] }, phase4: null, mint: null, source: 'test' });
  assert.equal(out.summary.rules_total, 18);
  assert.equal(out.scope.token_age.regime, 'unknown');
});

// ---------- Phase 11: limitations rezim dini ----------

function p11WithRegime(regime) {
  const p = [];
  p[9] = {
    scope: { token_age: { regime, age_minutes: 90, birth_source: 'earliest_phase8_event' } },
    rules: [{ rule_id: 'CTR-02', status: 'NOT_TRIGGERED' }],
  };
  return p11.buildReport(p, 'MintTestR26AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
}

test('R26: Phase 11 menandai rezim dini (menit) di limitations; tidak untuk rezim matang', () => {
  const early = p11WithRegime('early');
  const line = early.limitations.find(s => s.includes('Regime dini'));
  assert.ok(line, 'limitations rezim dini harus ada');
  assert.ok(line.includes('90 menit'), 'umur harus dalam menit');
  assert.ok(line.includes('bersifat sementara'), 'sifat sementara threshold harus disebut');
  const mature = p11WithRegime('mature');
  assert.equal(mature.limitations.some(s => s.includes('Regime dini')), false);
});
