const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const W = s => (`X${s}`.padEnd(44, '9')).slice(0, 44);
const CREATOR = W('C'.repeat(38));
const TOPSELL = W('S'.repeat(38));
const TOPBUY = W('B'.repeat(38));

const spr03Rule = rules.categories.SELL_PRESSURE_RISK.rules['SPR-03'];
const tcr01Rule = rules.categories.TRADING_CONCENTRATION_RISK.rules['TCR-01'];
const empty8 = { wallets: [] };
const phase5Connected = {
  ownership: { creator_address: CREATOR },
  creator_discovery: { selected: { address: CREATOR } },
  dev_relationship: { address: null },
  related_wallets: { wallets: [] }
};

/* Windowed fixture modeled on Rin's real 8DXq run (1133 parsed, partial):
 * top seller 16.01% of windowed sell volume, creator inactive in window. */
function mvWindowed(over = {}) {
  return {
    coverage: { completeness: 'partial', transactions_parsed: 1133, transactions_failed: 367, signatures_seen: 2000 },
    window: { first_block_time: 1790000000, last_block_time: 1791000000 },
    totals: { buy_volume_raw: '31026591462713', sell_volume_raw: '31949627530705', trade_volume_raw: '62976218993418' },
    wallets: {},
    top_sellers: [{ wallet: TOPSELL, sell_volume_raw: '5114148448888', txs: 2 }],
    top_buyers: [{ wallet: TOPBUY, buy_volume_raw: '4493166756072', txs: 174 }],
    ...over
  };
}
const ctx = (rule, mv) => ({ phase8: empty8, phase5: phase5Connected, marketVolume: mv, rules });

test('SPR-03 windowed NOT_TRIGGERED on adequate partial window (no forcing)', () => {
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule, ctx(spr03Rule, mvWindowed()));
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.equal(r.metric.tier, 'windowed');
  assert.equal(r.metric.scope, 'windowed_recent_signatures');
  assert.match(r.reason, /observed-window/);
  assert.ok(r.metric.window_characterization);
  assert.equal(r.metric.window_characterization.transactions_parsed, 1133);
});

test('SPR-03 windowed TRIGGERED when connected share >= 5% in window', () => {
  const mv = mvWindowed({ wallets: { [CREATOR]: { buy_raw: '0', sell_raw: '4000000000000', txs: 9 } } });
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule, ctx(spr03Rule, mv));
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.tier, 'windowed');
  assert.match(r.reason, /observed-window/);
});

test('TCR-01 windowed NOT_TRIGGERED at 16% top share (honest, not forced)', () => {
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule, ctx(tcr01Rule, mvWindowed()));
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.equal(r.metric.tier, 'windowed');
  assert.equal(r.metric.top_share_ratio, 0.1601); // 5114148448888/31949627530705
});

test('TCR-01 windowed TRIGGERED when top share >= 30% in window', () => {
  const mv = mvWindowed({ top_sellers: [{ wallet: TOPSELL, sell_volume_raw: '15000000000000', txs: 12 }] });
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule, ctx(tcr01Rule, mv));
  assert.equal(r.status, 'TRIGGERED');
  assert.match(r.reason, /observed-window/);
});

test('TCR-01 below adequacy floor stays INSUFFICIENT_DATA with diagnostic', () => {
  const mv = mvWindowed({ coverage: { completeness: 'partial', transactions_parsed: 100 } });
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule, ctx(tcr01Rule, mv));
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.ok(r.metric.top_share_of_observed_volume_pct !== undefined); // diagnostic preserved
  assert.match(r.metric.market_volume_gate, /adequacy floor/);
});

test('complete tier keeps market-wide scope label', () => {
  const mv = mvWindowed({ coverage: { completeness: 'complete', transactions_parsed: 2500 } });
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule, ctx(tcr01Rule, mv));
  assert.equal(r.metric.tier, 'complete');
  assert.equal(r.metric.scope, 'market_wide_complete_sidecar');
  assert.match(r.reason, /market-wide/);
});

/* blockTime bugfix (v1.0.2): blockTime is top-level in getTransaction result. */
const MINT = 'MintMintMintMintMintMintMintMintMintMint12';
function txWithBlockTime(topLevel, metaLevel, sig) {
  const tx = {
    slot: 9,
    transaction: { signatures: [sig], message: { accountKeys: ['UserUserUserUserUserUserUserUserUserUser12'] } },
    meta: { err: null, preBalances: [0], postBalances: [0], preTokenBalances: [], postTokenBalances: [] }
  };
  if (topLevel != null) tx.blockTime = topLevel;
  if (metaLevel != null) tx.meta.blockTime = metaLevel;
  return tx;
}

test('classifyTxFlow reads top-level blockTime (v1.0.2 fix)', () => {
  const c = mkt.classifyTxFlow(txWithBlockTime(1791036396, null, 'bt1'), MINT);
  assert.equal(c.block_time, 1791036396);
});

test('classifyTxFlow falls back to meta.blockTime when top-level absent', () => {
  const c = mkt.classifyTxFlow(txWithBlockTime(null, 1791036396, 'bt2'), MINT);
  assert.equal(c.block_time, 1791036396);
});

test('classifyTxFlow block_time null when both absent (old files)', () => {
  const c = mkt.classifyTxFlow(txWithBlockTime(null, null, 'bt3'), MINT);
  assert.equal(c.block_time, null);
});
