'use strict';
/* Test keputusan Rin 2026-10-13: A1, A2, B1, B2, D1. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { creatorCandidates } = require(path.join(root, 'Script/phase5_creator_dev_analysis.js'));
const { rugChecklist } = require(path.join(root, 'Script/phase12_early_signals.js'));
const { knownDexPool } = require(path.join(root, 'Script/phase4_holder_concentration.js'));
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const { loadCexIndex, buildCexIndex, withoutCexWallets } = require(path.join(root, 'Script/cex_registry.js'));
const { applyDbAdjustments } = require(path.join(root, 'Script/db_conviction_metrics.js'));

/* ---------------- A1: atribusi creator ---------------- */
test('A1: POOL_COIN_CREATOR selalu LOW (tidak pernah HIGH)', () => {
  const c = creatorCandidates({ liquidity_mapping: { confirmed_pools: [
    { coin_creator: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', confidence: 'HIGH', dex: 'PumpSwap' },
  ]}});
  assert.equal(c.length, 1);
  assert.equal(c[0].role, 'POOL_COIN_CREATOR');
  assert.equal(c[0].confidence, 'LOW');
  assert.match(c[0].evidence, /BUKAN token deployer/);
});

test('A1: phase12 CREATOR_SELL WARN (bukan FAIL) bila atribusi lemah', () => {
  const phases = [];
  phases[5] = {
    creator_discovery: { selected: { address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', confidence: 'LOW', role: 'POOL_COIN_CREATOR' } },
    creator_events: { sell: { sell_count: 236 } },
  };
  const items = rugChecklist(phases, {});
  const chk = items.find(i => i.id === 'CREATOR_SELL');
  assert.equal(chk.status, 'WARN');
  assert.match(chk.detail, /LEMAH/);
});

test('A1: phase12 CREATOR_SELL tetap FAIL bila atribusi kuat', () => {
  const phases = [];
  phases[5] = {
    creator_discovery: { selected: { address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', confidence: 'HIGH', role: 'METADATA_CREATOR' } },
    creator_events: { sell: { sell_count: 3 } },
  };
  const chk = rugChecklist(phases, {}).find(i => i.id === 'CREATOR_SELL');
  assert.equal(chk.status, 'FAIL');
});

/* ---------------- A2: filter pool UNKNOWN ---------------- */
test('A2: knownDexPool menolak pool tanpa identitas DEX', () => {
  assert.equal(knownDexPool({ dex: 'PumpSwap' }), true);
  assert.equal(knownDexPool({ program_name: 'Raydium' }), true);
  assert.equal(knownDexPool({ dex: 'UNKNOWN' }), false);
  assert.equal(knownDexPool({}), false);
  assert.equal(knownDexPool({ dex: '', program_name: null }), false);
  assert.equal(knownDexPool(null), false);
});

/* ---------------- B1: guard kredibilitas likuiditas ---------------- */
test('B1: liquidityCredibility pure', () => {
  // pool 14.9M vs volume 3.9T (kasus 9cRC) -> tidak kredibel
  let r = p9.liquidityCredibility(14919861958n, 3927488090861n, {});
  assert.equal(r.credible, false);
  assert.ok(r.pool_share_of_volume < 0.01);
  // pool 728M vs volume 3M (kasus BONK) -> kredibel
  r = p9.liquidityCredibility(728607359157583n, 3050560372104n, {});
  assert.equal(r.credible, true);
  // override config
  r = p9.liquidityCredibility(14919861958n, 3927488090861n, { liquidity_credibility_ratio: 0.000001 });
  assert.equal(r.credible, true);
  // tanpa volume -> null (ditangani jalur lain)
  assert.equal(p9.liquidityCredibility(100n, 0n, {}).credible, null);
});

const mkPhase8Sell = (wallet, amtRaw) => ({
  wallets: [{ wallet, history: { events: [
    { event_class: 'SELL', amount_raw: String(amtRaw), block_time: 1700000000, signature: 'sig1', event_id: 'e1' },
  ]}}],
});
const mkPhase4Pool = (baseRaw) => ({
  liquidity_mapping: { significant_pools: [{ pool: 'pool1', program_name: 'PumpSwap',
    liquidity_snapshot: { base: { status: 'FOUND', amount_raw: String(baseRaw) }, snapshot_utc: '2026-01-01T00:00:00Z' } }] },
});
const SPR05 = { threshold: 0.05, enabled: true };

test('B1: SPR-05 INSUFFICIENT_DATA bila pool tidak kredibel (kasus 9cRC)', () => {
  const res = p9.evaluateRule('SPR-05', 'SELL_PRESSURE_RISK', SPR05,
    { phase8: mkPhase8Sell('w1', 3927488090861n), phase4: mkPhase4Pool(14919861958n), guards: {} });
  assert.equal(res.status, 'INSUFFICIENT_DATA');
  assert.match(res.reason, /kredibilitas/);
  // rasio mentah tetap dipublikasikan sebagai diagnostik
  assert.ok(res.metric.sell_to_liquidity_ratio > 200);
  assert.equal(res.metric.liquidity_credibility.credible, false);
});

test('B1: SPR-05 tetap TRIGGERED bila pool kredibel', () => {
  const res = p9.evaluateRule('SPR-05', 'SELL_PRESSURE_RISK', SPR05,
    { phase8: mkPhase8Sell('w1', 1000n), phase4: mkPhase4Pool(10000n), guards: {} });
  assert.equal(res.status, 'TRIGGERED');
  assert.equal(res.metric.sell_to_liquidity_ratio, 0.1);
});

test('B1: LTR-04 INSUFFICIENT_DATA bila reserve tidak kredibel', () => {
  const res = p9.evaluateRule('LTR-04', 'LIQUIDITY_RELATED_TRADING_RISK', { threshold: 0.05, enabled: true },
    { phase8: mkPhase8Sell('w1', 80717097357620n), phase4: mkPhase4Pool(6672n), guards: {} });
  assert.equal(res.status, 'INSUFFICIENT_DATA');
  assert.match(res.reason, /kredibilitas/);
});

/* ---------------- B2: registry CEX ---------------- */
const BINANCE_SAMPLE = '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9';

test('B2: registry termuat (171 alamat) dan policy eksplisit', () => {
  const idx = loadCexIndex(root);
  assert.equal(idx.size, 171);
  assert.equal(idx.labelOf(BINANCE_SAMPLE), 'Binance');
  assert.equal(idx.labelOf('11111111111111111111111111111111'), null);
  assert.equal(idx.has(BINANCE_SAMPLE), true);
});

test('B2: withoutCexWallets memisahkan dengan label', () => {
  const idx = buildCexIndex({ _meta: {}, X: { addresses: [BINANCE_SAMPLE] } });
  const { clean, excluded } = withoutCexWallets(idx, [{ wallet: BINANCE_SAMPLE }, { wallet: 'abc' }], e => e.wallet);
  assert.equal(clean.length, 1);
  assert.equal(excluded.length, 1);
  assert.equal(excluded[0].cex_label, 'X');
});

test('B2: TCR-02 melewati top buyer CEX ke wallet non-CEX', () => {
  const mv = {
    coverage: { completeness: 'complete' },
    totals: { buy_volume_raw: '1000', sell_volume_raw: '500', trade_volume_raw: '1500' },
    top_buyers: [
      { wallet: BINANCE_SAMPLE, buy_volume_raw: '885', txs: 10 },
      { wallet: 'RetailWallet11111111111111111111111111', buy_volume_raw: '50', txs: 3 },
    ],
    top_sellers: [],
  };
  const res = p9.evaluateTcr0102('TCR-02', { marketVolume: mv, rule: { threshold: 0.3, enabled: true } });
  // top CEX (88.5%) dikecualikan -> top berikutnya 5% -> NOT_TRIGGERED
  assert.equal(res.status, 'NOT_TRIGGERED');
  assert.equal(res.metric.top_wallet, 'RetailWallet11111111111111111111111111');
  assert.equal(res.metric.top_share_ratio, 0.05);
  assert.equal(res.metric.cex_wallets_excluded_from_ranking.length, 1);
  assert.equal(res.metric.cex_wallets_excluded_from_ranking[0].cex_label, 'Binance');
});

/* ---------------- D1: retention/conviction keluar dari holder ---------------- */
test('D1: holder_distribution tidak lagi menerima komponen DB', () => {
  const dims = [{ id: 'holder_distribution', score: 60, available: true, details: {}, reason: 'x' }];
  const dbm = { status: 'OK', matched_count: 10, metrics: {
    retention: { rate: 0.09 }, conviction: { normalized: -0.54 },
    coordinated_sell: { rate: 0.1 }, fast_exit: { rate: 0.4 }, bundler_overlap: { rate: 0 },
  }};
  const out = applyDbAdjustments(dims, dbm, {});
  assert.equal(out[0].details.db_adjustment.applied, false);
  assert.equal(out[0].score, 60);
});

test('D1: risk_findings tetap menerima coordinated_sell/fast_exit/negative_conviction', () => {
  const dims = [{ id: 'risk_findings', score: 25, available: true, details: {}, reason: 'x' }];
  const dbm = { status: 'OK', matched_count: 10, metrics: {
    retention: { rate: 0.09 }, conviction: { normalized: -0.54 },
    coordinated_sell: { rate: 0.1 }, fast_exit: { rate: 0.4 }, bundler_overlap: { rate: 0 },
  }};
  const out = applyDbAdjustments(dims, dbm, {});
  const keys = out[0].details.db_adjustment.components.map(c => c.key).sort();
  assert.deepEqual(keys, ['coordinated_sell', 'fast_exit', 'negative_conviction']);
  assert.ok(out[0].details.db_adjustment.total_points < 0);
});
