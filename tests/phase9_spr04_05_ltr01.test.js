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

// Wallet D: buy 1000, sell 800 via SELL (peak 1000, sell/peak=0.8) -> SPR-04 triggers
function walletD() {
  const w = 'WalletDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
  return {
    wallet: w, current: { balance_raw: '200000000' },
    history: { complete: true, events: [ev(w, 'BUY', 1000000000, 1, 'sigD1'), ev(w, 'SELL', 800000000, 2, 'sigD2')] }
  };
}

// Wallet E: buy 1000, transfer out 800 (reorganization, not sell) -> SPR-04 must NOT trigger
function walletE() {
  const w = 'WalletEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
  return {
    wallet: w, current: { balance_raw: '200000000' },
    history: { complete: true, events: [ev(w, 'BUY', 1000000000, 1, 'sigE1'), ev(w, 'TRANSFER_OUT', 800000000, 2, 'sigE2')] }
  };
}

const spr04Rule = rules.categories.SELL_PRESSURE_RISK.rules['SPR-04'];
const spr05Rule = rules.categories.SELL_PRESSURE_RISK.rules['SPR-05'];
const ltr01Rule = rules.categories.LIQUIDITY_RELATED_TRADING_RISK.rules['LTR-01'];

function phase4WithPool(baseRaw) {
  return {
    holders: [],
    liquidity_mapping: {
      significant_pools: [{
        pool: 'PoolPoolPoolPoolPoolPoolPoolPoolPoolPoolPool1',
        program_name: 'PumpSwap',
        liquidity_snapshot: {
          snapshot_utc: '2026-10-11T00:00:00.000Z',
          base: { status: 'FOUND', amount_raw: String(baseRaw), decimals: 6, amount_ui: Number(baseRaw) / 1e6 },
          quote: { status: 'FOUND', amount_raw: '1000000000', decimals: 9, amount_ui: 1 }
        }
      }]
    }
  };
}

test('SPR-04 triggers when SELL-attributed outflow >= 20% of peak', () => {
  const r = p9.evaluateRule('SPR-04', 'SELL_PRESSURE_RISK', spr04Rule,
    { phase8: { wallets: [walletD()] }, phase4: { holders: [] }, rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.qualifying_wallets, 1);
  assert.ok(Math.abs(r.evidence_refs[0].sell_attributed_ratio - 0.8) < 1e-9);
});

test('SPR-04 does NOT treat TRANSFER_OUT reorganization as sell exit', () => {
  const r = p9.evaluateRule('SPR-04', 'SELL_PRESSURE_RISK', spr04Rule,
    { phase8: { wallets: [walletE()] }, phase4: { holders: [] }, rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.equal(r.metric.evaluated_wallets, 1);
});

test('SPR-05 triggers when observed sell volume >= 5% of pool liquidity', () => {
  // sell 800 of pool base 10000 -> 8% >= 5%
  const r = p9.evaluateRule('SPR-05', 'SELL_PRESSURE_RISK', spr05Rule,
    { phase8: { wallets: [walletD()] }, phase4: phase4WithPool(10000000000), rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.ok(Math.abs(r.metric.sell_to_liquidity_ratio - 0.08) < 1e-9);
});

test('SPR-05 stays INSUFFICIENT_DATA without a pool snapshot (never assumed)', () => {
  const r = p9.evaluateRule('SPR-05', 'SELL_PRESSURE_RISK', spr05Rule,
    { phase8: { wallets: [walletD()] }, phase4: { holders: [] }, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.metric.pool_liquidity_status, 'unavailable');
});

test('LTR-01 uses rolling 3600s window for burst-vs-depth', () => {
  const w = 'WalletFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
  const wallet = {
    wallet: w, current: { balance_raw: '0' },
    history: {
      complete: true,
      events: [
        ev(w, 'BUY', 1000000000, 1, 'sigF0'),
        // two sells 400 each, 100s apart -> 800 in window; pool 10000 -> 8% >= 5%
        ev(w, 'SELL', 400000000, 100, 'sigF1'),
        ev(w, 'SELL', 400000000, 200, 'sigF2'),
        ev(w, 'TRANSFER_OUT', 200000000, 300, 'sigF3')
      ]
    }
  };
  const r = p9.evaluateRule('LTR-01', 'LIQUIDITY_RELATED_TRADING_RISK', ltr01Rule,
    { phase8: { wallets: [wallet] }, phase4: phase4WithPool(10000000000), rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.window_seconds, 3600);
  assert.ok(Math.abs(r.metric.sell_to_liquidity_ratio - 0.08) < 1e-9);
});

test('LTR-01 does not trigger when burst is below threshold', () => {
  const w = 'WalletGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG';
  const wallet = {
    wallet: w, current: { balance_raw: '900000000' },
    history: {
      complete: true,
      events: [ev(w, 'BUY', 1000000000, 1, 'sigG0'), ev(w, 'SELL', 100000000, 100, 'sigG1')]
    }
  };
  const r = p9.evaluateRule('LTR-01', 'LIQUIDITY_RELATED_TRADING_RISK', ltr01Rule,
    { phase8: { wallets: [wallet] }, phase4: phase4WithPool(10000000000), rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});
