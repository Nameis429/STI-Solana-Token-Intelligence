const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const W = s => (`X${s}`.padEnd(44, '9')).slice(0, 44); // base58-valid synthetic address
const WA = W('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const WB = W('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
const WC = W('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');
const CREATOR = W('CADEVCADEVCADEVCADEVCADEVCADEVCADEVCADEV');
const REL1 = W('RELATED1RELATED1RELATED1RELATED1RELATED');
const TOPSELL = W('TOPSELLERTOPSELLERTOPSELLERTOPSELLERTOPSE');
const TOPBUY = W('TOPBUYERTOPBUYERTOPBUYERTOPBUYERTOPBUYER');

function ev(wallet, cls, amount, ts, sig, extra = {}) {
  return {
    event_id: `${sig}:${cls}`, signature: sig, slot: 1000 + ts, block_time: 1700000000 + ts,
    event_class: cls, amount_raw: String(amount), amount_ui: Number(amount) / 1e6,
    timestamp_utc: '2026-01-01T00:00:00.000Z', wallet, ...extra
  };
}
function walletWith(wallet, events, complete = true) {
  return { wallet, current: { balance_raw: '0' }, history: { complete, events } };
}
function poolFixture(program, baseRaw) {
  return {
    holders: [],
    liquidity_mapping: {
      significant_pools: [{
        pool: W('POOLPOOLPOOLPOOLPOOLPOOLPOOLPOOLPOOLPOOL'),
        program_name: program,
        liquidity_snapshot: baseRaw == null ? { snapshot_utc: '2026-10-11T00:00:00.000Z' } : {
          snapshot_utc: '2026-10-11T00:00:00.000Z',
          base: { status: 'FOUND', amount_raw: String(baseRaw), decimals: 6, amount_ui: Number(baseRaw) / 1e6 },
          quote: { status: 'FOUND', amount_raw: '1000000000', decimals: 9, amount_ui: 1 }
        }
      }]
    }
  };
}
function mvComplete(over = {}) {
  return {
    coverage: { completeness: 'complete' },
    window: { first_block_time: 1700000000, last_block_time: 1700086400 },
    totals: { buy_volume_raw: '1000000', sell_volume_raw: '1000000', trade_volume_raw: '2000000' },
    wallets: {
      [CREATOR]: { buy_raw: '0', sell_raw: '120000', txs: 5 },
      [REL1]: { buy_raw: '10000', sell_raw: '10000', txs: 4 }
    },
    top_sellers: [{ wallet: TOPSELL, sell_volume_raw: '400000', txs: 10 }],
    top_buyers: [{ wallet: TOPBUY, buy_volume_raw: '100000', txs: 3 }],
    ...over
  };
}
const phase5Connected = {
  ownership: { creator_address: CREATOR },
  creator_discovery: { selected: { address: CREATOR } },
  dev_relationship: { address: null },
  related_wallets: { wallets: [{ address: REL1 }] }
};
const spr03Rule = rules.categories.SELL_PRESSURE_RISK.rules['SPR-03'];
const ctr04Rule = rules.categories.COORDINATED_TRADING_RISK.rules['CTR-04'];
const tcr01Rule = rules.categories.TRADING_CONCENTRATION_RISK.rules['TCR-01'];
const tcr02Rule = rules.categories.TRADING_CONCENTRATION_RISK.rules['TCR-02'];
const tcr03Rule = rules.categories.TRADING_CONCENTRATION_RISK.rules['TCR-03'];
const tcr04Rule = rules.categories.TRADING_CONCENTRATION_RISK.rules['TCR-04'];
const ltr04Rule = rules.categories.LIQUIDITY_RELATED_TRADING_RISK.rules['LTR-04'];
const ctr05Rule = rules.categories.COORDINATED_TRADING_RISK.rules['CTR-05'];
const empty8 = { wallets: [] };

/* ---------------- SPR-03 / CTR-04 / TCR-03 (market-gated) ---------------- */

test('SPR-03 INSUFFICIENT_DATA without market-volume.json', () => {
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: null, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

test('SPR-03 INSUFFICIENT_DATA with partial market-volume.json', () => {
  const mv = mvComplete({ coverage: { completeness: 'partial' } });
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: mv, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.match(r.reason, /partial/i);
});

test('SPR-03 TRIGGERED when connected sell share >= 5% of market trade', () => {
  // connected sell = 120000 + 10000 = 130000; market trade = 2000000 -> 6.5%
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: mvComplete(), rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.connected_share_ratio, 0.065);
});

test('SPR-03 NOT_TRIGGERED when connected sell share < 5%', () => {
  const mv = mvComplete({ wallets: { [CREATOR]: { buy_raw: '0', sell_raw: '10000', txs: 1 } } });
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: mv, rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});

test('SPR-03 INSUFFICIENT_DATA when Phase 5 yields no connected wallets', () => {
  const r = p9.evaluateRule('SPR-03', 'SELL_PRESSURE_RISK', spr03Rule,
    { phase8: empty8, phase5: {}, marketVolume: mvComplete(), rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

test('CTR-04 TRIGGERED when connected trade share >= 10%', () => {
  // connected trade = (0+120000) + (10000+10000) = 140000 / 2000000 = 7% -> NOT triggered
  const r1 = p9.evaluateRule('CTR-04', 'COORDINATED_TRADING_RISK', ctr04Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: mvComplete(), rules });
  assert.equal(r1.status, 'NOT_TRIGGERED');
  // bump creator sell to 200000 -> (200000+20000)/2000000 = 11% -> triggered
  const mv = mvComplete({ wallets: { [CREATOR]: { buy_raw: '0', sell_raw: '200000', txs: 8 }, [REL1]: { buy_raw: '10000', sell_raw: '10000', txs: 4 } } });
  const r2 = p9.evaluateRule('CTR-04', 'COORDINATED_TRADING_RISK', ctr04Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: mv, rules });
  assert.equal(r2.status, 'TRIGGERED');
});

test('TCR-03 TRIGGERED when connected concentration >= 50%', () => {
  const mv = mvComplete({
    wallets: { [CREATOR]: { buy_raw: '500000', sell_raw: '600000', txs: 20 } },
    totals: { buy_volume_raw: '1000000', sell_volume_raw: '1000000', trade_volume_raw: '2000000' }
  });
  const r = p9.evaluateRule('TCR-03', 'TRADING_CONCENTRATION_RISK', tcr03Rule,
    { phase8: empty8, phase5: phase5Connected, marketVolume: mv, rules });
  assert.equal(r.status, 'TRIGGERED'); // 1100000/2000000 = 55%
});

/* ---------------- TCR-01 / TCR-02 (real, gated; diagnostic fallback) ---------------- */

test('TCR-01 keeps diagnostic INSUFFICIENT_DATA without market-volume.json', () => {
  const p8 = { wallets: [walletWith(WA, [ev(WA, 'SELL', 500000, 1, 's1'), ev(WA, 'SELL', 500000, 2, 's2')])] };
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule,
    { phase8: p8, marketVolume: null, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.metric.top_share_of_observed_volume_pct, 100);
  assert.match(r.metric.evaluator_note, /COMPLETE market-volume/);
});

test('TCR-01 TRIGGERED when top seller >= 30% of market sell volume', () => {
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule,
    { phase8: empty8, marketVolume: mvComplete(), rules });
  assert.equal(r.status, 'TRIGGERED'); // 400000/1000000 = 40%
  assert.equal(r.metric.top_wallet, TOPSELL);
});

test('TCR-01 NOT_TRIGGERED when top seller < 30%', () => {
  const mv = mvComplete({ top_sellers: [{ wallet: TOPSELL, sell_volume_raw: '100000', txs: 4 }] });
  const r = p9.evaluateRule('TCR-01', 'TRADING_CONCENTRATION_RISK', tcr01Rule,
    { phase8: empty8, marketVolume: mv, rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});

test('TCR-02 TRIGGERED when top buyer >= 30% of market buy volume', () => {
  const mv = mvComplete({ top_buyers: [{ wallet: TOPBUY, buy_volume_raw: '350000', txs: 6 }] });
  const r = p9.evaluateRule('TCR-02', 'TRADING_CONCENTRATION_RISK', tcr02Rule,
    { phase8: empty8, marketVolume: mv, rules });
  assert.equal(r.status, 'TRIGGERED');
});

/* ---------------- TCR-04 (HHI concentration increase) ---------------- */

function tcr04Wallets() {
  // H1 (ts 0..500): A,B,C trade 600 each (5x BUY 60 + 5x SELL 60).
  // H2 (ts 501..1000): A trades 1800, B/C trade 20 each -> concentration spikes.
  const mk = (w, unit, n, t0) => {
    const e = [];
    for (let i = 0; i < n; i++) {
      e.push(ev(w, 'BUY', unit, t0 + i, `b1${w.slice(6, 10)}${t0}_${i}`));
      e.push(ev(w, 'SELL', unit, t0 + 100 + i, `s1${w.slice(6, 10)}${t0}_${i}`));
    }
    return walletWith(w, e);
  };
  return [
    { w: WA, h1: mk(WA, 60, 5, 0), h2: mk(WA, 180, 5, 600) },
    { w: WB, h1: mk(WB, 60, 5, 0), h2: mk(WB, 2, 5, 600) },
    { w: WC, h1: mk(WC, 60, 5, 0), h2: mk(WC, 2, 5, 600) }
  ].map(({ w, h1, h2 }) => walletWith(w, [...h1.history.events, ...h2.history.events]));
}

test('TCR-04 TRIGGERED when HHI rises >= 15pp between halves', () => {
  const p8 = { wallets: tcr04Wallets() };
  const r = p9.evaluateRule('TCR-04', 'TRADING_CONCENTRATION_RISK', tcr04Rule,
    { phase8: p8, rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.ok(r.metric.delta_pp >= 15, `delta_pp=${r.metric.delta_pp}`);
  assert.equal(r.metric.comparable_wallets, 3);
});

test('TCR-04 NOT_TRIGGERED when concentration is flat', () => {
  const mk = w => {
    const e = [];
    for (let i = 0; i < 3; i++) {
      e.push(ev(w, 'BUY', 150, i, `f1${w.slice(6, 10)}${i}`));
      e.push(ev(w, 'SELL', 150, 100 + i, `f2${w.slice(6, 10)}${i}`));
      e.push(ev(w, 'BUY', 150, 600 + i, `f3${w.slice(6, 10)}${i}`));
      e.push(ev(w, 'SELL', 150, 700 + i, `f4${w.slice(6, 10)}${i}`));
    }
    return walletWith(w, e);
  };
  const r = p9.evaluateRule('TCR-04', 'TRADING_CONCENTRATION_RISK', tcr04Rule,
    { phase8: { wallets: [mk(WA), mk(WB), mk(WC)] }, rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
  assert.ok(Math.abs(r.metric.delta_pp) < 1, `delta_pp=${r.metric.delta_pp}`);
});

test('TCR-04 INSUFFICIENT_DATA when a half has fewer than 10 events (small-sample guard)', () => {
  // H1 dense (30 events), H2 sparse (6 events) -> guard refuses even though HHI would spike.
  const mk = (w, n, t0, tag) => {
    const e = [];
    for (let i = 0; i < n; i++) e.push(ev(w, i % 2 ? 'SELL' : 'BUY', 100, t0 + i, `${tag}${w.slice(6, 10)}${i}`));
    return e;
  };
  const p8 = {
    wallets: [WA, WB, WC].map(w => walletWith(w, [...mk(w, 10, 0, 'g1'), ...mk(w, 2, 600, 'g2')]))
  };
  const r = p9.evaluateRule('TCR-04', 'TRADING_CONCENTRATION_RISK', tcr04Rule,
    { phase8: p8, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.match(r.reason, />=10 events in each half/);
});

test('TCR-04 INSUFFICIENT_DATA with fewer than 3 comparable wallets', () => {
  const p8 = { wallets: tcr04Wallets().slice(0, 2) };
  const r = p9.evaluateRule('TCR-04', 'TRADING_CONCENTRATION_RISK', tcr04Rule,
    { phase8: p8, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

test('TCR-04 INSUFFICIENT_DATA when a wallet starts mid-window (coverage mismatch)', () => {
  const late = walletWith(W('LATEWALLET1234567890123456789012345678'), [
    ev(W('LATEWALLET1234567890123456789012345678'), 'BUY', 999999, 900, 'late1'),
    ev(W('LATEWALLET1234567890123456789012345678'), 'SELL', 999999, 950, 'late2')
  ]);
  const p8 = { wallets: [...tcr04Wallets().slice(0, 2), late] };
  const r = p9.evaluateRule('TCR-04', 'TRADING_CONCENTRATION_RISK', tcr04Rule,
    { phase8: p8, rules });
  // late wallet excluded from comparable set -> only 2 comparable -> INSUFFICIENT_DATA
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

/* ---------------- LTR-04 (constant-product price impact) ---------------- */

test('LTR-04 TRIGGERED when modeled impact >= 5%', () => {
  // reserve 1_000_000; sells 100_000 -> 100000/1100000 = 9.09%
  const p8 = { wallets: [walletWith(WA, [ev(WA, 'SELL', 100000, 1, 'l41')])] };
  const p4 = poolFixture('PumpSwap', 1000000);
  const r = p9.evaluateRule('LTR-04', 'LIQUIDITY_RELATED_TRADING_RISK', ltr04Rule,
    { phase8: p8, phase4: p4, rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.ok(Math.abs(r.metric.modeled_price_impact_ratio - 0.0909) < 0.001);
  assert.equal(r.metric.model, 'constant_product_x_times_y_eq_k');
});

test('LTR-04 NOT_TRIGGERED when modeled impact < 5%', () => {
  const p8 = { wallets: [walletWith(WA, [ev(WA, 'SELL', 10000, 1, 'l43')])] };
  const r = p9.evaluateRule('LTR-04', 'LIQUIDITY_RELATED_TRADING_RISK', ltr04Rule,
    { phase8: p8, phase4: poolFixture('PumpSwap', 1000000), rules });
  assert.equal(r.status, 'NOT_TRIGGERED');
});

test('LTR-04 INSUFFICIENT_DATA for unmodeled protocol', () => {
  const p8 = { wallets: [walletWith(WA, [ev(WA, 'SELL', 100000, 1, 'l44')])] };
  const r = p9.evaluateRule('LTR-04', 'LIQUIDITY_RELATED_TRADING_RISK', ltr04Rule,
    { phase8: p8, phase4: poolFixture('Meteora DLMM', 1000000), rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.match(r.reason, /No validated price-impact model/);
});

test('LTR-04 INSUFFICIENT_DATA without pool snapshot', () => {
  const p8 = { wallets: [walletWith(WA, [ev(WA, 'SELL', 100000, 1, 'l45')])] };
  const r = p9.evaluateRule('LTR-04', 'LIQUIDITY_RELATED_TRADING_RISK', ltr04Rule,
    { phase8: p8, phase4: { holders: [] }, rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

/* ---------------- CTR-05 (verified-relationship path) ---------------- */

function ctr05Pair(sender, recipient, relId, t0, tag) {
  const t = { relationship_verified: true, relationship_id: relId };
  return [
    walletWith(sender, [ev(sender, 'TRANSFER_OUT', 1000, t0, `t${tag}`, { counterparty: recipient, ...t })]),
    walletWith(recipient, [ev(recipient, 'SELL', 900, t0 + 100, `s${tag}`, { ...t })])
  ];
}

test('CTR-05 TRIGGERED with 2 verified relationship sequences', () => {
  const p8 = { wallets: [...ctr05Pair(WA, WB, 'rel-1', 100, 'a'), ...ctr05Pair(WC, CREATOR, 'rel-2', 200, 'b')] };
  const r = p9.evaluateRule('CTR-05', 'COORDINATED_TRADING_RISK', ctr05Rule,
    { phase8: p8, phase4: { holders: [] }, events: p9.flatEvents(p8), rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.linked_event_count, 2);
});

test('CTR-05 INSUFFICIENT_DATA for unverified sequences with incomplete coverage', () => {
  const mkPair = (sender, recipient, t0, tag) => [
    walletWith(sender, [ev(sender, 'TRANSFER_OUT', 1000, t0, `u${tag}`, { counterparty: recipient })], false),
    walletWith(recipient, [ev(recipient, 'SELL', 900, t0 + 100, `v${tag}`)], false)
  ];
  const p8 = { wallets: [...mkPair(WA, WB, 100, 'a'), ...mkPair(WC, CREATOR, 200, 'b')] };
  const r = p9.evaluateRule('CTR-05', 'COORDINATED_TRADING_RISK', ctr05Rule,
    { phase8: p8, phase4: { holders: [] }, events: p9.flatEvents(p8), rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});

/* ---------------- classifyTxFlow (market-volume parser) ---------------- */

const MINT = 'MintMintMintMintMintMintMintMintMintMint12';
function fakeTx({ owner, tokenDelta, solDelta, sig, err = null }) {
  const preTok = tokenDelta >= 0 ? 0n : -BigInt(tokenDelta);
  const postTok = tokenDelta >= 0 ? BigInt(tokenDelta) : 0n;
  const preSol = solDelta >= 0 ? 0 : -solDelta;
  const postSol = solDelta >= 0 ? solDelta : 0;
  return {
    slot: 42,
    transaction: { signatures: [sig], message: { accountKeys: [{ pubkey: owner, signer: true, writable: true }] } },
    meta: {
      err, blockTime: 1700000000,
      preBalances: [preSol], postBalances: [postSol],
      preTokenBalances: [{ accountIndex: 0, mint: MINT, owner, uiTokenAmount: { amount: String(preTok) } }],
      postTokenBalances: [{ accountIndex: 0, mint: MINT, owner, uiTokenAmount: { amount: String(postTok) } }]
    }
  };
}

test('classifyTxFlow: token in + SOL out = BUY', () => {
  const c = mkt.classifyTxFlow(fakeTx({ owner: WA, tokenDelta: 1000, solDelta: -50000, sig: 'sigB' }), MINT);
  assert.equal(c.skipped_reason, null);
  assert.equal(c.flows.length, 1);
  assert.equal(c.flows[0].kind, 'BUY');
  assert.equal(c.flows[0].token_delta_raw, 1000n);
});

test('classifyTxFlow: token out + SOL in = SELL', () => {
  const c = mkt.classifyTxFlow(fakeTx({ owner: WA, tokenDelta: -1000, solDelta: 50000, sig: 'sigS' }), MINT);
  assert.equal(c.flows[0].kind, 'SELL');
  assert.equal(c.flows[0].token_delta_raw, -1000n);
});

test('classifyTxFlow: token move with fee-only SOL delta = TRANSFER', () => {
  const c = mkt.classifyTxFlow(fakeTx({ owner: WA, tokenDelta: -1000, solDelta: -5000, sig: 'sigT' }), MINT);
  assert.equal(c.flows[0].kind, 'TRANSFER');
});

test('classifyTxFlow: failed tx is skipped', () => {
  const c = mkt.classifyTxFlow(fakeTx({ owner: WA, tokenDelta: 1000, solDelta: -50000, sig: 'sigF', err: { InstructionError: [0, 'Custom'] } }), MINT);
  assert.equal(c.skipped_reason, 'failed_or_missing_tx');
  assert.equal(c.flows.length, 0);
});

test('connectedWalletSet picks up creator + related addresses', () => {
  const s = p9.connectedWalletSet(phase5Connected);
  assert.ok(s.has(CREATOR));
  assert.ok(s.has(REL1));
  assert.equal(s.size, 2);
});

test('marketVolumeTier classifies none/complete/windowed/unusable', () => {
  assert.equal(p9.marketVolumeTier(null).tier, 'none');
  assert.equal(p9.marketVolumeTier(mvComplete()).tier, 'complete');
  assert.equal(p9.marketVolumeTier(mvComplete({ coverage: { completeness: 'partial', transactions_parsed: 600 } })).tier, 'windowed');
  assert.equal(p9.marketVolumeTier(mvComplete({ coverage: { completeness: 'partial', transactions_parsed: 100 } })).tier, 'unusable');
  assert.equal(p9.marketVolumeTier(mvComplete({ coverage: { completeness: 'partial' } })).tier, 'unusable');
});
