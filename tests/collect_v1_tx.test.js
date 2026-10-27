'use strict';
/* Ronde 13c: regresi bug RPC_-32015 — kolektor meminta getTransaction dengan
 * maxSupportedTransactionVersion: 0 sehingga SEMUA transaksi v1 gagal
 * deterministik ("Transaction version (1) is not supported by the requesting
 * client", dok. Helius) dan retry takkan pernah memulihkannya.
 * Perbaikan: minta versi 1. Parser version-agnostic (hanya baca meta). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const mkt = require(path.join(root, 'Script/collect_market_volume.js'));
const fg = require(path.join(root, 'Script/collect_funding_graph.js'));

test('market_volume: fetchAndClassify meminta maxSupportedTransactionVersion=1', async () => {
  let captured = null;
  const doRpc = async (method, params) => { captured = { method, params }; return null; };
  const r = await mkt.fetchAndClassify('sigX', doRpc, 'MINTY', { minIntervalMs: 0, timeoutMs: 50 });
  assert.equal(captured.method, 'getTransaction');
  assert.equal(captured.params[1].encoding, 'jsonParsed');
  assert.equal(captured.params[1].maxSupportedTransactionVersion, 1);
  assert.equal(r.status, 'permanent'); // tx null -> not_found (bukan retryable)
  assert.equal(r.reason, 'not_found');
});

test('funding_graph: GET_TRANSACTION_OPTS memakai maxSupportedTransactionVersion=1', () => {
  assert.equal(fg.GET_TRANSACTION_OPTS.encoding, 'jsonParsed');
  assert.equal(fg.GET_TRANSACTION_OPTS.maxSupportedTransactionVersion, 1);
});

test('classifyTxFlow: transaksi bentuk v1 (accountKeys objek) tetap terklasifikasi', () => {
  // Bentuk v1 jsonParsed: accountKeys berisi objek {pubkey}, bukan string.
  const v1tx = {
    blockTime: 1760000000,
    slot: 12345,
    meta: {
      err: null,
      fee: 5000,
      preBalances: [2000000, 500000],
      postBalances: [1500000, 500000], // owner bayar 500k lamports (> FEE_BUFFER 8000)
      preTokenBalances: [{ accountIndex: 1, mint: 'MINTY', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: 'MINTY', owner: 'OWNER', uiTokenAmount: { amount: '1000000', decimals: 6 } }],
    },
    transaction: {
      message: {
        accountKeys: [{ pubkey: 'OWNER' }, { pubkey: 'ATA' }],
        instructions: [],
      },
    },
  };
  const c = mkt.classifyTxFlow(v1tx, 'MINTY');
  assert.ok(!c.skipped_reason, `ter-skip: ${c.skipped_reason}`);
  assert.equal(c.flows.length, 1);
  assert.equal(c.flows[0].kind, 'BUY');
  assert.equal(c.flows[0].owner, 'OWNER');
  assert.equal(c.block_time, 1760000000);
});

test('fetchAndClassify: tx v1 penuh berstatus ok (bug -32015 tidak terulang)', async () => {
  const v1tx = {
    blockTime: 1760000000,
    meta: {
      err: null, fee: 5000,
      preBalances: [2000000], postBalances: [1500000],
      preTokenBalances: [{ accountIndex: 0, mint: 'MINTY', owner: 'OWNER', uiTokenAmount: { amount: '0', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 0, mint: 'MINTY', owner: 'OWNER', uiTokenAmount: { amount: '1000000', decimals: 6 } }],
    },
    transaction: { message: { accountKeys: ['OWNER'], instructions: [] } },
  };
  const doRpc = async () => v1tx;
  const r = await mkt.fetchAndClassify('sigV1', doRpc, 'MINTY', { minIntervalMs: 0, timeoutMs: 50 });
  assert.equal(r.status, 'ok');
  assert.equal(r.flows[0].kind, 'BUY');
});
