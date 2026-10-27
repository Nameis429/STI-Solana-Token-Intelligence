const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

function ev(wallet, cls, amount, ts, sig) {
  return {
    event_id: `${sig}:${cls}`, signature: sig, slot: 1000 + ts, block_time: 1700000000 + ts,
    event_class: cls, amount_raw: String(amount), amount_ui: Number(amount) / 1e6,
    timestamp_utc: '2026-01-01T00:00:00.000Z', wallet
  };
}

// Wallet A: buys 1000, sells 300 (>=20%) -> reconciled (1000-300=700 current)
function walletA() {
  const w = 'WalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  return {
    wallet: w,
    current: { balance_raw: '700000000' },
    history: {
      complete: true,
      events: [
        ev(w, 'BUY', 1000000000, 1, 'sigA1'),
        ev(w, 'SELL', 300000000, 2, 'sigA2'),
      ]
    }
  };
}

// Wallet B: buys 1000, sells 100 (<20%) -> reconciled, no trigger
function walletB() {
  const w = 'WalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  return {
    wallet: w,
    current: { balance_raw: '900000000' },
    history: {
      complete: true,
      events: [
        ev(w, 'BUY', 1000000000, 1, 'sigB1'),
        ev(w, 'SELL', 100000000, 2, 'sigB2'),
      ]
    }
  };
}

// Wallet C: sells more than bought (unreconcilable) -> excluded
function walletC() {
  const w = 'WalletCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
  return {
    wallet: w,
    current: { balance_raw: '0' },
    history: {
      complete: true,
      events: [ev(w, 'SELL', 500000000, 1, 'sigC1')]
    }
  };
}

const phase4 = { holders: [] };
const spr01Rule = rules.categories.SELL_PRESSURE_RISK.rules['SPR-01'];

function runSpr01(wallets) {
  return p9.evaluateRule('SPR-01', 'SELL_PRESSURE_RISK', spr01Rule,
    { phase8: { wallets, mint: 'MintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' }, phase4, rules });
}

test('SPR-01 triggers on a >=20% single-sell exit with reconciled ledger', () => {
  const r = runSpr01([walletA()]);
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.qualifying_sell_events, 1);
  assert.equal(r.metric.evaluated_wallets, 1);
  assert.ok(Math.abs(r.evidence_refs[0].sell_ratio - 0.3) < 1e-9);
  assert.equal(r.threshold, 0.2);
});

test('SPR-01 does not trigger on small sells (honest negative)', () => {
  const r = runSpr01([walletB()]);
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.equal(r.metric.evaluated_wallets, 1);
  assert.equal(r.metric.qualifying_sell_events, 0);
});

test('SPR-01 excludes unreconcilable ledgers instead of penalizing', () => {
  const r = runSpr01([walletC()]);
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.metric.evaluated_wallets, 0);
  assert.equal(r.metric.excluded_wallets_unreconciled_or_incomplete, 1);
});

test('SPR-01 excludes confirmed LIQUIDITY_POOL wallets', () => {
  const lp = walletA();
  const p4 = { holders: [{ owner: lp.wallet, classification: 'LIQUIDITY_POOL' }] };
  const r = p9.evaluateRule('SPR-01', 'SELL_PRESSURE_RISK', spr01Rule,
    { phase8: { wallets: [lp], mint: 'MintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' }, phase4: p4, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.metric.evaluated_wallets, 0);
});

test('SPR-01 threshold comes from rule config, not a hidden constant', () => {
  const custom = { ...spr01Rule, threshold: 0.5 };
  const r = p9.evaluateRule('SPR-01', 'SELL_PRESSURE_RISK', custom,
    { phase8: { wallets: [walletA()], mint: 'MintXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' }, phase4, rules });
  // 30% < 50% custom threshold -> no trigger
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.equal(r.metric.threshold_sell_ratio, 0.5);
});

test('TCR-01 publishes diagnostic metric but stays INSUFFICIENT_DATA', () => {
  const tcr = rules.categories.TRADING_CONCENTRATION_RISK.rules['TCR-01'];
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr,
    { phase8: { wallets: [walletA(), walletB()] }, phase4, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.metric.event_class, 'SELL');
  assert.equal(r.metric.wallets_with_volume, 2);
  assert.equal(r.metric.scope, 'bounded_phase8_sample_not_market_total');
  assert.equal(r.metric.threshold_status, 'unaudited_no_trigger_evaluated');
  assert.ok(r.metric.top_share_of_observed_volume_pct > 0);
});
