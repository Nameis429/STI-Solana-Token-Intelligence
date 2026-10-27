const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const W = s => (`X${s}`.padEnd(44, '9')).slice(0, 44); // base58-valid synthetic address
const USER = W('USERUSERUSERUSERUSERUSERUSERUSERUSERUSER');
const ATA = W('ATAATAATAATAATAATAATAATAATAATAATAATAAT');
const MINT = 'MintMintMintMintMintMintMintMintMintMint12';
const CREATOR = W('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC');

/* Realistic tx shape (bug v1.0.0 -> v1.0.1):
 * index 0 = user's NATIVE SOL account, index 1 = user's ATA for the mint.
 * The old classifier measured SOL delta on the ATA (always ~0) so every
 * swap became TRANSFER. The fix sums SOL delta over all indexes whose
 * pubkey == owner. */
function realisticTx({ tokenDelta, solDelta, sig }) {
  const preTok = tokenDelta >= 0 ? 0n : -BigInt(tokenDelta);
  const postTok = tokenDelta >= 0 ? BigInt(tokenDelta) : 0n;
  const preSol = solDelta >= 0 ? 0 : -solDelta;
  const postSol = solDelta >= 0 ? solDelta : 0;
  return {
    slot: 42,
    transaction: {
      signatures: [sig],
      message: { accountKeys: [USER, ATA] }
    },
    meta: {
      err: null, blockTime: 1700000000,
      preBalances: [preSol, 0], postBalances: [postSol, 0],
      preTokenBalances: [{ accountIndex: 1, mint: MINT, owner: USER, uiTokenAmount: { amount: String(preTok) } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, owner: USER, uiTokenAmount: { amount: String(postTok) } }]
    }
  };
}

test('classifyTxFlow v1.0.1: swap BUY detected via native SOL account (not ATA)', () => {
  // ATA: +1000 tokens; user native account: -50000 lamports -> BUY.
  // v1.0.0 measured SOL on the ATA (0) and returned TRANSFER.
  const c = mkt.classifyTxFlow(realisticTx({ tokenDelta: 1000, solDelta: -50000, sig: 'rB' }), MINT);
  assert.equal(c.flows.length, 1);
  assert.equal(c.flows[0].kind, 'BUY');
  assert.equal(c.flows[0].sol_delta_lamports, -50000);
});

test('classifyTxFlow v1.0.1: swap SELL detected via native SOL account', () => {
  const c = mkt.classifyTxFlow(realisticTx({ tokenDelta: -1000, solDelta: 50000, sig: 'rS' }), MINT);
  assert.equal(c.flows[0].kind, 'SELL');
});

test('classifyTxFlow v1.0.1: pure transfer stays TRANSFER (fee-only SOL move)', () => {
  const c = mkt.classifyTxFlow(realisticTx({ tokenDelta: -1000, solDelta: -5000, sig: 'rT' }), MINT);
  assert.equal(c.flows[0].kind, 'TRANSFER');
});

test('classifyTxFlow v1.0.1: legacy single-account shape still works', () => {
  const tx = {
    slot: 1,
    transaction: { signatures: ['lg'], message: { accountKeys: [USER] } },
    meta: {
      err: null, blockTime: 1,
      preBalances: [100000], postBalances: [50000],
      preTokenBalances: [{ accountIndex: 0, mint: MINT, owner: USER, uiTokenAmount: { amount: '0' } }],
      postTokenBalances: [{ accountIndex: 0, mint: MINT, owner: USER, uiTokenAmount: { amount: '1000' } }]
    }
  };
  const c = mkt.classifyTxFlow(tx, MINT);
  assert.equal(c.flows[0].kind, 'BUY');
});

/* Sidecar plumbing regression (bug: explicit-mint Phase 9 runs never
 * loaded funding-graph.json / liquidity_history.jsonl / market-volume.json
 * because main() forgot to pass mint through to runEvaluation).
 * This test goes through runEvaluation with a mint + a real sidecar file
 * on disk, exactly like `node Script/phase9_risk_engine.js <mint>`. */
function mvComplete() {
  return {
    coverage: { completeness: 'complete' },
    window: { first_block_time: 1700000000, last_block_time: 1700086400 },
    totals: { buy_volume_raw: '1000000', sell_volume_raw: '1000000', trade_volume_raw: '2000000' },
    wallets: { [CREATOR]: { buy_raw: '0', sell_raw: '200000', txs: 5 } },
    top_sellers: [], top_buyers: []
  };
}
const phase5Connected = {
  ownership: { creator_address: CREATOR },
  creator_discovery: { selected: { address: CREATOR } },
  dev_relationship: { address: null },
  related_wallets: { wallets: [] }
};
const spr03Rule = rules.categories.SELL_PRESSURE_RISK.rules['SPR-03'];

function withTempMintDir(mint, files, fn) {
  const dir = path.join(root, 'Output', mint);
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const [name, obj] of Object.entries(files))
      fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('runEvaluation(mint) loads market-volume.json sidecar (explicit-mint plumbing)', () => {
  const mint = W('QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ');
  withTempMintDir(mint, { 'market-volume.json': mvComplete() }, () => {
    const r = p9.runEvaluation({ rules, phase8: { wallets: [] }, phase4: null, phase5: phase5Connected, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'SPR-03');
    // connected sell 200000 / market trade 2000000 = 10% >= 5% -> TRIGGERED.
    // Before the fix, mint was dropped and this stayed INSUFFICIENT_DATA
    // with "No market-volume.json found".
    assert.equal(s.status, 'TRIGGERED');
    assert.equal(s.metric.connected_share_ratio, 0.1);
  });
});

test('CLI `node Script/phase9_risk_engine.js <mint>` loads sidecars (exact Rinaldi repro)', () => {
  // Reproduksi persis perintah yang Rin jalankan dari menu 9 di Termux.
  // Bug: main() tidak meneruskan mint -> runEvaluation(mint=undefined) ->
  // semua sidecar (funding-graph, liquidity_history, market-volume) diam-diam
  // diabaikan ("No market-volume.json found" walau file ada).
  const { execFileSync } = require('node:child_process');
  const mint = W('MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM');
  const phase8 = { input: { mint }, wallets: [] };
  withTempMintDir(mint, { 'phase8-result.json': phase8, 'phase5-result.json': phase5Connected, 'market-volume.json': mvComplete() }, dir => {
    execFileSync('node', ['Script/phase9_risk_engine.js', mint], { cwd: root, timeout: 30000, stdio: 'pipe' });
    const out = JSON.parse(fs.readFileSync(path.join(dir, 'phase9-result.json'), 'utf8'));
    const s = out.rules.find(x => x.rule_id === 'SPR-03');
    assert.equal(s.status, 'TRIGGERED');
  });
});
test('runEvaluation(mint) without sidecar stays INSUFFICIENT_DATA (no false trigger)', () => {
  const mint = W('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
  withTempMintDir(mint, {}, () => {
    const r = p9.runEvaluation({ rules, phase8: { wallets: [] }, phase4: null, phase5: phase5Connected, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'SPR-03');
    assert.equal(s.status, 'INSUFFICIENT_DATA');
  });
});

/* ---------------- v1.0.3: retry hardening ---------------- */

test('fetchAndClassify: network error -> retryable', async () => {
  const r = await mkt.fetchAndClassify('s1', async () => { throw new Error('timeout'); }, MINT, { minIntervalMs: 0, timeoutMs: 1000 });
  assert.equal(r.status, 'retryable');
  assert.match(r.reason, /fetch_error/);
});

test('fetchAndClassify: null tx -> permanent not_found', async () => {
  const r = await mkt.fetchAndClassify('s1', async () => null, MINT, { minIntervalMs: 0, timeoutMs: 1000 });
  assert.equal(r.status, 'permanent');
  assert.equal(r.reason, 'not_found');
});

test('fetchAndClassify: on-chain failed tx -> permanent parse_skipped', async () => {
  const bad = realisticTx({ tokenDelta: 1, solDelta: -9000, sig: 'sxr5' });
  bad.meta.err = { InstructionError: [0, 'Custom'] };
  const r = await mkt.fetchAndClassify('s1', async () => bad, MINT, { minIntervalMs: 0, timeoutMs: 1000 });
  assert.equal(r.status, 'permanent');
  assert.match(r.reason, /parse_skipped/);
});

test('fetchAndClassify: good tx -> ok with flows', async () => {
  const good = realisticTx({ tokenDelta: 1000, solDelta: -50000, sig: 'syr5' });
  const r = await mkt.fetchAndClassify('s1', async () => good, MINT, { minIntervalMs: 0, timeoutMs: 1000 });
  assert.equal(r.status, 'ok');
  assert.equal(r.flows[0].kind, 'BUY');
});

function scriptedFetchOne(script, seenOpts) {
  const calls = {};
  return async (sig, opts) => {
    if (seenOpts) (seenOpts[sig] = seenOpts[sig] || []).push({ ...opts });
    const seq = script[sig] || ['ok'];
    const n = calls[sig] || 0;
    const o = seq[Math.min(n, seq.length - 1)];
    calls[sig] = n + 1;
    if (o === 'retryable') return { status: 'retryable', reason: 'fetch_error:boom' };
    if (o === 'permanent') return { status: 'permanent', reason: 'not_found' };
    return { status: 'ok', flows: [{ owner: 'W', token_delta_raw: 100n, sol_delta_lamports: -9000, kind: 'BUY' }], block_time: 1700000000 };
  };
}

test('collectSignatures: retry passes recover transient failures, keep permanent ones', async () => {
  const fetchOne = scriptedFetchOne({ a: ['retryable', 'ok'], b: ['retryable', 'retryable', 'ok'], c: ['retryable', 'retryable', 'retryable'], d: ['permanent'], e: ['ok'] });
  const { state, failed, recovered } = await mkt.collectSignatures(['a', 'b', 'c', 'd', 'e'], fetchOne,
    { delayMs: 0, timeoutMs: 1000, retryPasses: 2, retryDelayMs: 0 }, null);
  assert.equal(state.parsed, 3); // e (main) + a (pass 1) + b (pass 2)
  assert.deepEqual(failed, ['c']);
  assert.equal(recovered, 2);
  assert.equal(state.permanent, 1); // d
  assert.equal(state.buyVol, 300n);
});

test('collectSignatures: retryPasses=0 keeps transient failures untouched', async () => {
  const fetchOne = scriptedFetchOne({ a: ['retryable', 'ok'] });
  const { state, failed, recovered } = await mkt.collectSignatures(['a'], fetchOne,
    { delayMs: 0, timeoutMs: 1000, retryPasses: 0, retryDelayMs: 0 }, null);
  assert.deepEqual(failed, ['a']);
  assert.equal(recovered, 0);
  assert.equal(state.parsed, 0);
});

test('collectSignatures: retry passes use longer timeout and retry delay', async () => {
  const seenOpts = {};
  const fetchOne = scriptedFetchOne({ a: ['retryable', 'ok'] }, seenOpts);
  await mkt.collectSignatures(['a'], fetchOne,
    { delayMs: 100, timeoutMs: 1000, retryPasses: 1, retryDelayMs: 777 }, null);
  assert.equal(seenOpts.a.length, 2);
  assert.equal(seenOpts.a[0].timeoutMs, 1000); // main pass
  assert.equal(seenOpts.a[0].minIntervalMs, 100);
  assert.equal(seenOpts.a[1].timeoutMs, 2000); // retry: 2x, capped 60000
  assert.equal(seenOpts.a[1].minIntervalMs, 777);
});

/* ---------------- v1.0.4: config.json-based settings ---------------- */

test('resolveCollectorOpts: defaults when nothing set', () => {
  assert.deepEqual(mkt.resolveCollectorOpts({}, null),
    { maxTx: 1500, delayMs: 300, pageLimit: 1000, retryPasses: 2, retryDelayMs: 1500, timeoutMs: 25000, concurrency: 3 });
});

test('resolveCollectorOpts: config file fills unset CLI flags', () => {
  const o = mkt.resolveCollectorOpts({}, { max_tx: 5000, retry_passes: 4 });
  assert.equal(o.maxTx, 5000);
  assert.equal(o.retryPasses, 4);
  assert.equal(o.delayMs, 300); // default preserved
});

test('resolveCollectorOpts: CLI flag beats config file', () => {
  const o = mkt.resolveCollectorOpts({ maxTx: 777 }, { max_tx: 5000 });
  assert.equal(o.maxTx, 777);
});

test('resolveCollectorOpts: sanitizes bounds and bad values', () => {
  const o = mkt.resolveCollectorOpts({}, { max_tx: -5, page_limit: 99999, timeout_ms: 100, delay_ms: 'abc', retry_passes: 'x' });
  assert.equal(o.maxTx, 1);
  assert.equal(o.pageLimit, 1000); // capped
  assert.equal(o.timeoutMs, 5000); // floored
  assert.equal(o.delayMs, 300); // 'abc' -> default
  assert.equal(o.retryPasses, 2); // 'x' -> default
});

test('resolveCollectorOpts: ignores non-object file config', () => {
  assert.equal(mkt.resolveCollectorOpts({}, 'nope').maxTx, 1500);
  assert.equal(mkt.resolveCollectorOpts(null, null).delayMs, 300);
});
