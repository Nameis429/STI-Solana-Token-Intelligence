'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

// Alamat base58 valid (44 char) agar lolos validasi connectedWalletSet.
const W1 = 'W1111111111111111111111111111111111111111111';
const W2 = 'W2222222222222222222222222222222222222222222';
const W3 = 'W3333333333333333333333333333333333333333333';
const CREATOR = 'C4444444444444444444444444444444444444444444';

function mvFixture() {
  return {
    coverage: { completeness: 'partial', transactions_parsed: 600 },
    totals: { trade_volume_raw: '1000', buy_volume_raw: '400', sell_volume_raw: '600' },
    top_sellers: [{ wallet: W1, sell_volume_raw: '360', txs: 5 }],
    top_buyers: [{ wallet: W2, buy_volume_raw: '200', txs: 3 }],
    wallets: {
      [W1]: { buy_raw: '0', sell_raw: '360', txs: 5,
        halves: { recent: { buy_raw: '0', sell_raw: '300', txs: 3 }, older: { buy_raw: '0', sell_raw: '60', txs: 2 } } },
      [W3]: { buy_raw: '100', sell_raw: '240', txs: 4,
        halves: { recent: { buy_raw: '50', sell_raw: '120', txs: 2 }, older: { buy_raw: '50', sell_raw: '120', txs: 2 } } },
    },
    halves: {
      recent: { buy_volume_raw: '200', sell_volume_raw: '420', trade_volume_raw: '620', transactions: 300 },
      older: { buy_volume_raw: '200', sell_volume_raw: '180', trade_volume_raw: '380', transactions: 300 },
    },
  };
}

/* ---------- kolektor: paruh window ---------- */

test('collectSignatures membagi paruh menurut urutan fetch', async () => {
  const flow = (owner, kind, amt) => ({ owner, kind, token_delta_raw: kind === 'SELL' ? -BigInt(amt) : BigInt(amt), sol_delta_lamports: 0 });
  const fetchOne = async (sig) => {
    const i = Number(sig.slice(1)); // s0..s3
    return { status: 'ok', block_time: 1700000000 + i,
      flows: i < 2 ? [flow('A', 'SELL', 100)] : [flow('B', 'BUY', 50)] };
  };
  const { state } = await mkt.collectSignatures(['s0', 's1', 's2', 's3'], fetchOne,
    { delayMs: 0, timeoutMs: 50, retryPasses: 0, retryDelayMs: 0 });
  assert.equal(state.halfTotals.recent.sell, 200n); // s0,s1 = recent
  assert.equal(state.halfTotals.older.buy, 100n);   // s2,s3 = older
  assert.equal(state.halfTotals.recent.txs, 2);
  assert.equal(state.halfTotals.older.txs, 2);
  const wA = state.perWallet.get('A');
  assert.equal(wA.halves.recent.sell, 200n);
  assert.equal(wA.halves.older.sell, 0n);
});

test('paruh konsisten saat retry (index asli dibawa)', async () => {
  const seen = new Set();
  const fetchOne = async (sig) => {
    if (sig === 's1' && !seen.has(sig)) { seen.add(sig); return { status: 'retryable', reason: 'timeout' }; }
    return { status: 'ok', block_time: 1700000000,
      flows: [{ owner: 'A', kind: 'SELL', token_delta_raw: -100n, sol_delta_lamports: 0 }] };
  };
  const { state, recovered } = await mkt.collectSignatures(['s0', 's1', 's2', 's3'], fetchOne,
    { delayMs: 0, timeoutMs: 50, retryPasses: 1, retryDelayMs: 0 });
  assert.equal(recovered, 1);
  // s0,s1 recent (2 tx), s2,s3 older (2 tx) — retry tidak menggeser paruh
  assert.equal(state.halfTotals.recent.txs, 2);
  assert.equal(state.halfTotals.older.txs, 2);
  assert.equal(state.halfTotals.recent.sell, 200n);
});

/* ---------- helper Phase 9 ---------- */

test('topShareHalves: top wallet per paruh + spread', () => {
  const s = p9.topShareHalves(mvFixture(), 'SELL');
  assert.equal(s.recent.top_wallet, W1);
  assert.equal(s.recent.top_share_ratio, 0.7143); // 300/420
  assert.equal(s.older.top_wallet, W3);          // 120/180 > 60/180
  assert.equal(s.older.top_share_ratio, 0.6667);
  assert.equal(s.spread_pp, 4.76);
});

test('connectedShareHalves: share connected per paruh', () => {
  const s = p9.connectedShareHalves(mvFixture(), new Set([W1]), 'sell');
  assert.equal(s.recent.connected_share_ratio, 0.4839); // 300/620
  assert.equal(s.older.connected_share_ratio, 0.1579);   // 60/380
  assert.equal(s.spread_pp, 32.6);
});

test('tanpa field halves -> null (diagnostik dilewati, bukan dipaksa)', () => {
  assert.equal(p9.topShareHalves({ totals: {} }, 'SELL'), null);
  assert.equal(p9.connectedShareHalves({}, new Set(), 'sell'), null);
});

/* ---------- end-to-end via runEvaluation ---------- */

function withTempMintDir(mint, files, fn) {
  const dir = path.join(root, 'Output', mint);
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  try {
    for (const [name, data] of Object.entries(files)) {
      const fp = path.join(dir, name);
      fs.writeFileSync(fp, JSON.stringify(data));
      written.push(fp);
    }
    return fn();
  } finally {
    for (const fp of written) fs.rmSync(fp, { force: true });
    try { fs.rmdirSync(dir); } catch {}
  }
}

test('TCR-01 windowed: metric memuat window_stability; status tak berubah', () => {
  const mint = 'WSTAB11111111111111111111111111111111111111';
  withTempMintDir(mint, { 'market-volume.json': mvFixture() }, () => {
    const r = p9.runEvaluation({ rules, phase8: { wallets: [] }, phase4: null, phase5: null, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'TCR-01');
    assert.equal(s.status, 'TRIGGERED'); // 360/600 = 0.6 >= 0.3 — logika lama utuh
    assert.equal(s.metric.tier, 'windowed');
    const ws = s.metric.window_stability;
    assert.ok(ws);
    assert.equal(ws.recent.top_wallet, W1);
    assert.equal(ws.spread_pp, 4.76);
  });
});

test('file lama tanpa halves: window_stability.available === false', () => {
  const mint = 'WSTAB22222222222222222222222222222222222222';
  const old = mvFixture(); delete old.halves;
  withTempMintDir(mint, { 'market-volume.json': old }, () => {
    const r = p9.runEvaluation({ rules, phase8: { wallets: [] }, phase4: null, phase5: null, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'TCR-01');
    assert.equal(s.status, 'TRIGGERED'); // status tidak dipengaruhi
    assert.equal(s.metric.window_stability.available, false);
  });
});

test('SPR-03 windowed: connected share per paruh di metric', () => {
  const mint = 'WSTAB33333333333333333333333333333333333333';
  const phase5 = { ownership: { creator_address: CREATOR }, creator_discovery: { selected: { address: CREATOR } },
    dev_relationship: { address: null }, related_wallets: { wallets: [W1] } };
  const mv = mvFixture();
  withTempMintDir(mint, { 'market-volume.json': mv }, () => {
    const r = p9.runEvaluation({ rules, phase8: { wallets: [] }, phase4: null, phase5, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'SPR-03');
    // connected sell total 360/600 = 0.6 >= 0.05 -> TRIGGERED (logika lama)
    assert.equal(s.status, 'TRIGGERED');
    const ws = s.metric.window_stability;
    assert.equal(ws.recent.connected_share_ratio, 0.4839);
    assert.equal(ws.older.connected_share_ratio, 0.1579);
  });
});
