'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));

const MINT = 'MINT1111111111111111111111111111111111111';
const T0 = 1700000000;

// accountKeys: [ownerNative, ata] sebagai string pubkey.
function fakeTx({ preToken, postToken, preSol, postSol, owner = 'ownerA', ata = 'ataA' }) {
  const preT = preToken === null ? [] :
    [{ accountIndex: 1, mint: MINT, owner, uiTokenAmount: { amount: String(preToken) } }];
  const postT = postToken === null ? [] :
    [{ accountIndex: 1, mint: MINT, owner, uiTokenAmount: { amount: String(postToken) } }];
  return {
    blockTime: T0, slot: 1,
    transaction: { signatures: ['sig1'], message: { accountKeys: [owner, ata] } },
    meta: { err: null, preTokenBalances: preT, postTokenBalances: postT,
      preBalances: [preSol, 0], postBalances: [postSol, 0] },
  };
}

test('akun ditutup setelah jual habis -> SELL terdeteksi (tidak hilang)', () => {
  // pre 1000 token, post hilang (ATA ditutup), SOL owner +100000 -> SELL
  const c = mkt.classifyTxFlow(fakeTx({ preToken: 1000, postToken: null, preSol: 5000000, postSol: 5100000 }), MINT);
  assert.equal(c.skipped_reason, null);
  assert.equal(c.flows.length, 1);
  assert.equal(c.flows[0].kind, 'SELL');
  assert.equal(c.flows[0].token_delta_raw, -1000n);
  assert.equal(c.flows[0].account_closed, true);
});

test('akun ditutup tapi token pindah ke ATA lain miliknya -> TRANSFER (bukan false SELL)', () => {
  const tx = {
    blockTime: T0, slot: 1,
    transaction: { signatures: ['sig2'], message: { accountKeys: ['ownerA', 'ataA', 'ataB'] } },
    meta: { err: null,
      preTokenBalances: [
        { accountIndex: 1, mint: MINT, owner: 'ownerA', uiTokenAmount: { amount: '1000' } },
        { accountIndex: 2, mint: MINT, owner: 'ownerA', uiTokenAmount: { amount: '0' } },
      ],
      postTokenBalances: [
        // ataA hilang (ditutup); ataB menerima 1000
        { accountIndex: 2, mint: MINT, owner: 'ownerA', uiTokenAmount: { amount: '1000' } },
      ],
      preBalances: [5000000, 0, 0], postBalances: [4995000, 0, 0] }, // hanya fee
  };
  const c = mkt.classifyTxFlow(tx, MINT);
  assert.equal(c.flows.length, 1);
  assert.equal(c.flows[0].kind, 'TRANSFER'); // net 0 -> bukan SELL
  assert.equal(c.flows[0].token_delta_raw, 0n);
});

test('akun ditutup dengan pre=0 -> tetap dilewati', () => {
  const c = mkt.classifyTxFlow(fakeTx({ preToken: 0, postToken: null, preSol: 5000000, postSol: 4995000 }), MINT);
  assert.equal(c.flows.length, 0);
});

test('ATA normal tidak berubah (regresi)', () => {
  const c = mkt.classifyTxFlow(fakeTx({ preToken: 1000, postToken: 400, preSol: 5000000, postSol: 5100000 }), MINT);
  assert.equal(c.flows.length, 1);
  assert.equal(c.flows[0].kind, 'SELL');
  assert.equal(c.flows[0].token_delta_raw, -600n);
  assert.equal(c.flows[0].account_closed, false);
});

test('collectSignatures mencatat breakdown alasan permanent skip', async () => {
  const okTx = () => ({ status: 'ok', flows: [], block_time: T0 });
  const fetchOne = async (sig) => {
    if (sig === 'a') return okTx();
    if (sig === 'b') return { status: 'permanent', reason: 'not_found' };
    if (sig === 'c') return { status: 'permanent', reason: 'parse_skipped:failed_or_missing_tx' };
    return { status: 'retryable', reason: 'timeout' };
  };
  const { state, failed } = await mkt.collectSignatures(['a', 'b', 'c', 'd'], fetchOne,
    { delayMs: 0, timeoutMs: 50, retryPasses: 0, retryDelayMs: 0 });
  assert.equal(state.permanent, 2);
  assert.deepEqual(state.permanentReasons, { not_found: 1, 'parse_skipped:failed_or_missing_tx': 1 });
  assert.deepEqual(failed, ['d']);
});

test('aggregateFlows menghitung closed_account_flows', () => {
  const st = { perWallet: new Map(), buyVol: 0n, sellVol: 0n, transferVol: 0n,
    parsed: 0, permanent: 0, permanentReasons: {}, closedAccountFlows: 0, firstTs: null, lastTs: null };
  mkt.aggregateFlows(st, [
    { owner: 'A', token_delta_raw: -1000n, kind: 'SELL', account_closed: true },
    { owner: 'B', token_delta_raw: 500n, kind: 'BUY', account_closed: false },
  ], T0);
  assert.equal(st.closedAccountFlows, 1);
  assert.equal(st.sellVol, 1000n);
  assert.equal(st.buyVol, 500n);
});
