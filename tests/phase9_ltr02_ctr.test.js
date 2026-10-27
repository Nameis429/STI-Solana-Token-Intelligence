const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));
const { extractInboundTransfers } = require(path.join(root, 'Script/collect_funding_graph.js'));

const R = rules.categories;

function ev(wallet, cls, amount, ts, sig) {
  return {
    event_id: `${sig}:${cls}`, signature: sig, slot: 1000 + ts, block_time: 1700000000 + ts,
    event_class: cls, amount_raw: String(amount), amount_ui: Number(amount) / 1e6,
    timestamp_utc: '2026-01-01T00:00:00.000Z', wallet
  };
}

// ---------- LTR-02 ----------
const ltr02Rule = R.LIQUIDITY_RELATED_TRADING_RISK.rules['LTR-02'];
function histWithDecline(declineFrac) {
  const oldBase = 10000000000n;
  const newBase = oldBase - (oldBase * BigInt(Math.round(declineFrac * 1000)) / 1000n);
  const pool = 'PoolPoolPoolPoolPoolPoolPoolPoolPoolPoolPool1';
  return [
    { snapshot_utc: '2026-10-10T00:00:00.000Z', pools: [{ pool, program: 'PumpSwap', base: { amount_raw: oldBase.toString() }, quote: { amount_raw: '1' } }] },
    { snapshot_utc: '2026-10-11T00:00:00.000Z', pools: [{ pool, program: 'PumpSwap', base: { amount_raw: newBase.toString() }, quote: { amount_raw: '1' } }] }
  ];
}

test('LTR-02 triggers on >=20% pool liquidity decline between scans', () => {
  const r = p9.evaluateRule('LTR-02', 'LIQUIDITY_RELATED_TRADING_RISK', ltr02Rule,
    { liquidityHistory: histWithDecline(0.3), rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.ok(r.metric.max_decline.decline_ratio >= 0.2);
});

test('LTR-02 stays INSUFFICIENT_DATA with fewer than two snapshots (never interpolated)', () => {
  const r = p9.evaluateRule('LTR-02', 'LIQUIDITY_RELATED_TRADING_RISK', ltr02Rule,
    { liquidityHistory: histWithDecline(0.3).slice(0, 1), rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

test('LTR-02 does not trigger below threshold', () => {
  const r = p9.evaluateRule('LTR-02', 'LIQUIDITY_RELATED_TRADING_RISK', ltr02Rule,
    { liquidityHistory: histWithDecline(0.05), rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});

// ---------- LTR-03 ----------
const ltr03Rule = R.LIQUIDITY_RELATED_TRADING_RISK.rules['LTR-03'];
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
function sellerWallet() {
  const w = 'WalletDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
  return {
    wallet: w, current: { balance_raw: '200000000' },
    history: { complete: true, events: [ev(w, 'BUY', 1000000000, 1, 'sigD1'), ev(w, 'SELL', 800000000, 2, 'sigD2')] }
  };
}

test('LTR-03 triggers only when BOTH sell pressure and decline hold', () => {
  const ctx = {
    phase8: { wallets: [sellerWallet()] },
    phase4: phase4WithPool(10000000000), // sell 800 / pool 10000 = 8% >= 5%
    liquidityHistory: histWithDecline(0.3),
    rules
  };
  const r = p9.evaluateRule('LTR-03', 'LIQUIDITY_RELATED_TRADING_RISK', ltr03Rule, ctx);
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.condition_a_sell_vs_liquidity.status, 'TRIGGERED');
  assert.equal(r.metric.condition_b_liquidity_decline.status, 'TRIGGERED');
});

test('LTR-03 stays NOT_TRIGGERED when only one condition holds', () => {
  const ctx = {
    phase8: { wallets: [sellerWallet()] },
    phase4: phase4WithPool(10000000000),
    liquidityHistory: histWithDecline(0.05), // below 20% decline
    rules
  };
  const r = p9.evaluateRule('LTR-03', 'LIQUIDITY_RELATED_TRADING_RISK', ltr03Rule, ctx);
  assert.equal(r.status, 'NOT_TRIGGERED');
});

// ---------- CTR-01 ----------
const ctr01Rule = R.COORDINATED_TRADING_RISK.rules['CTR-01'];
const wA = 'WalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const wB = 'WalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const funderF = 'FunderFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
function activeWallet(w) {
  return {
    wallet: w, current: { balance_raw: '100' },
    history: { complete: true, counts_observed: { BUY: 1, SELL: 0 }, events: [ev(w, 'BUY', 1000, 1, 'sigA' + w.slice(-2))] }
  };
}
function fundingGraphShared() {
  return {
    shared_funders: [{ funder: funderF, wallet_count: 2, wallets: [wA, wB] }],
    wallets: {
      [wA]: { funders: [{ funder: funderF, asset: 'SOL', amount_raw: '1000000', block_time: 1699999000 }] },
      [wB]: { funders: [{ funder: funderF, asset: 'SOL', amount_raw: '2000000', block_time: 1699999100 }] }
    }
  };
}

test('CTR-01 triggers on a shared funder linking >=2 active wallets', () => {
  const r = p9.evaluateRule('CTR-01', 'COORDINATED_TRADING_RISK', ctr01Rule,
    { phase8: { wallets: [activeWallet(wA), activeWallet(wB)] }, fundingGraph: fundingGraphShared(), rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.qualifying_shared_funders, 1);
  assert.match(r.reason, /Investigative lead/);
});

test('CTR-01 stays INSUFFICIENT_DATA without a funding graph (never assumed)', () => {
  const r = p9.evaluateRule('CTR-01', 'COORDINATED_TRADING_RISK', ctr01Rule,
    { phase8: { wallets: [activeWallet(wA)] }, fundingGraph: null, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

test('CTR-01 does not trigger when shared wallets are inactive', () => {
  const idle = { wallet: wA, current: { balance_raw: '0' }, history: { complete: true, counts_observed: { BUY: 0, SELL: 0 }, events: [] } };
  const r = p9.evaluateRule('CTR-01', 'COORDINATED_TRADING_RISK', ctr01Rule,
    { phase8: { wallets: [idle, activeWallet(wB)] }, fundingGraph: fundingGraphShared(), rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});

// ---------- CTR-02 ----------
const ctr02Rule = R.COORDINATED_TRADING_RISK.rules['CTR-02'];

test('CTR-02 triggers on funding -> first-trade within the window (ronde 25: threshold 10 sequences)', () => {
  const w = 'WalletCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
  const wallet = {
    wallet: w, current: { balance_raw: '500' },
    history: { complete: true, events: [ev(w, 'BUY', 500, 3600, 'sigC1')] } // first trade at 1700003600
  };
  // Ronde 25 (kalibrasi P5 final): CTR-02 bukan lagi biner — TRIGGERED
  // hanya bila >=10 funding->trade sequence. Fixture lama (1 sequence)
  // kini NOT_TRIGGERED; di sini dipakai 10 funder berbeda.
  const funders = Array.from({ length: 10 }, (_, i) => ({
    funder: `Funder${String(i).padStart(2, '0')}AAAAAAAAAAAAAAAAAAAAAAAAAA`,
    asset: 'SOL', amount_raw: '1000000', signature: `sigFund${i}`,
    block_time: 1700000000, timestamp_utc: '2026-01-01T00:00:00.000Z',
  }));
  const fg = { shared_funders: [], wallets: { [w]: { funders } } };
  const r = p9.evaluateRule('CTR-02', 'COORDINATED_TRADING_RISK', ctr02Rule,
    { phase8: { wallets: [wallet] }, fundingGraph: fg, rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.qualifying_sequences, 10);
  assert.equal(r.metric.min_count_threshold, 10);
  assert.equal(r.evidence_refs[0].delta_seconds, 3600);
});

test('CTR-02 ignores funding outside the window', () => {
  const w = 'WalletDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD2';
  const wallet = {
    wallet: w, current: { balance_raw: '500' },
    history: { complete: true, events: [ev(w, 'BUY', 500, 200000, 'sigD9')] } // 200000s after funding > 86400
  };
  const fg = {
    shared_funders: [],
    wallets: { [w]: { funders: [{ funder: funderF, asset: 'SOL', amount_raw: '1000000', signature: 'sigFund9', block_time: 1700000000 }] } }
  };
  const r = p9.evaluateRule('CTR-02', 'COORDINATED_TRADING_RISK', ctr02Rule,
    { phase8: { wallets: [wallet] }, fundingGraph: fg, rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});

// ---------- extractInboundTransfers (funding collector parsing) ----------
test('extractInboundTransfers finds native SOL inbound with heuristic funder', () => {
  const wallet = 'WalletEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
  const funder = 'FunderGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG';
  const tx = {
    transaction: { message: { accountKeys: [funder, wallet], instructions: [] } },
    meta: { preBalances: [1000000000, 0], postBalances: [900000000, 50000000], preTokenBalances: [], postTokenBalances: [], innerInstructions: [] }
  };
  const out = extractInboundTransfers(tx, wallet);
  assert.equal(out.length, 1);
  assert.equal(out[0].asset, 'SOL');
  assert.equal(out[0].amount_raw, '50000000');
  assert.equal(out[0].funder, funder);
  assert.match(out[0].attribution, /heuristic/);
});

test('extractInboundTransfers finds parsed token transfer to the wallet', () => {
  const wallet = 'WalletHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH';
  const funder = 'FunderIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII';
  const srcAcct = 'SrcAcctSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS';
  const dstAcct = 'DstAcctDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
  const mintTk = 'MintTkTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT';
  const tx = {
    transaction: {
      message: {
        accountKeys: [funder, srcAcct, dstAcct],
        instructions: [{
          parsed: { type: 'transfer', info: { source: srcAcct, destination: dstAcct, authority: funder, amount: '123456', mint: mintTk } }
        }]
      }
    },
    meta: {
      preBalances: [1, 1, 1], postBalances: [1, 1, 1],
      preTokenBalances: [{ accountIndex: 2, owner: wallet, mint: mintTk }],
      postTokenBalances: [{ accountIndex: 2, owner: wallet, mint: mintTk }],
      innerInstructions: []
    }
  };
  const out = extractInboundTransfers(tx, wallet);
  assert.equal(out.length, 1);
  assert.equal(out[0].funder, funder);
  assert.equal(out[0].amount_raw, '123456');
});
