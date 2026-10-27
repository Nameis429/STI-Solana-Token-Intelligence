'use strict';
/* Ronde 27 (audit protokol 24 jam, keputusan Rin 2026-10-27 malam):
 * Timeline TERKUNCI (dihitung sejak RILIS CA, bukan sejak scan-1):
 *   scan-1: 1-4 jam setelah rilis
 *   scan-2: 10-12 jam setelah rilis
 *   scan-3 (bila perlu): 24 jam setelah rilis (1440 menit)
 * Hasil audit evaluator-per-evaluator: TIDAK ADA window/threshold rule yang
 * perlu diubah untuk timeline ini — dan ronde 27 memang TIDAK mengubah satu
 * pun window/threshold. Buktinya di bawah:
 * - Window rule-rule ini adalah BATAS LAG MAKSIMUM antar dua event, BUKAN
 *   syarat lama observasi. CTR-05 (window 7 hari) tetap bisa TRIGGERED dari
 *   data 24 jam: pasangan transfer->sell berlag 3 jam tetap lolos window 7
 *   hari, karena lag-nya <= window. Yang dulu membuat CTR-05 INSUFFICIENT
 *   (22/22 Batch 1, 0/20 Batch 2) adalah verifikasi relationship + kelengkapan
 *   histori, BUKAN window-nya — memangkas window ke 24 jam tidak memperbaiki
 *   evaluabilitasnya, hanya membuang deteksi lag panjang untuk token matang.
 *   Koreksi atas klaim ronde 26 yang menyebut CTR-05 "secara struktural
 *   tidak bisa dievaluasi dalam 24 jam": klaim itu SALAH, dan tidak jadi
 *   dasar perubahan apa pun.
 * - LTR-02 memakai DUA snapshot terbaru; intervalnya DILAPORKAN, bukan
 *   disyaratkan sama dengan window_seconds (lihat kontrak evidence di kode).
 *   Dua snapshot berjarak 9 jam (scan-1 -> scan-2) sudah cukup untuk evaluasi.
 * - TCR-04 membagi RENTANG event yang teramati menjadi dua paruh — tidak ada
 *   syarat rentang minimum 24 jam.
 * Test-test ini mengunci perilaku tersebut: perubahan window di masa depan
 * yang merusak evaluabilitas 24 jam akan ketahuan di sini. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const R = rules.categories;
const ruleOf = id => Object.values(R).flatMap(g => Object.values(g.rules || {})).find(r => r && (r.evaluator === id || r.name));
const ctr05Rule = R.COORDINATED_TRADING_RISK.rules['CTR-05'];
const ltr02Rule = R.LIQUIDITY_RELATED_TRADING_RISK.rules['LTR-02'];

// ---------- Kunci konfigurasi: ronde 27 TIDAK mengubah window/threshold ----------

test('R27: tidak ada window/threshold yang berubah (SPR-02 30, CTR-02 10, CTR-05 604800, LTR-02 86400)', () => {
  const spr02 = Object.values(R).flatMap(g => Object.values(g.rules || {})).find(r => r.evaluator === 'SPR-02');
  const ctr02 = R.COORDINATED_TRADING_RISK.rules['CTR-02'];
  const ctr03 = R.COORDINATED_TRADING_RISK.rules['CTR-03'];
  assert.equal(spr02.min_count, 30);
  assert.equal(ctr02.min_count, 10);
  assert.equal(ctr05Rule.window_seconds, 604800);
  assert.equal(ctr02.window_seconds, 86400);
  assert.equal(ctr03.window_seconds, 86400);
  assert.equal(ltr02Rule.window_seconds, 86400);
  assert.equal(rules.settings.early_regime.age_minutes_max, 1440);
});

// ---------- CTR-05: window 7 hari TIDAK memblokir evaluasi 24 jam ----------

function ctr05Pair(wallet, funder, rel, t0, lagSec, tag) {
  return [
    { wallet, event: { event_class: 'RECEIVE', signature: `t-${tag}`, block_time: t0, counterparty: funder, relationship_verified: true, relationship_id: rel } },
    { wallet, event: { event_class: 'SELL', signature: `s-${tag}`, block_time: t0 + lagSec, counterparty: null, relationship_verified: true, relationship_id: rel } },
  ];
}

test('R27: CTR-05 TRIGGERED dari 2 sekuens terverifikasi berlag 3 jam dalam observasi 24 jam (window 604800 tidak diubah)', () => {
  const t0 = 1700000000; // semua event dalam satu jendela 24 jam
  const events = [
    ...ctr05Pair('WalletCTR27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Funder27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'REL-27-A', t0, 10800, 'a'),
    ...ctr05Pair('WalletCTR27BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'Funder27BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'REL-27-B', t0 + 3600, 10800, 'b'),
  ];
  const r = p9.evaluateRule('CTR-05', 'COORDINATED_TRADING_RISK', ctr05Rule,
    { events, phase8: { wallets: [] }, phase4: {}, rules });
  assert.equal(r.status, 'TRIGGERED');
  assert.equal(r.metric.linked_event_count, 2);
  assert.equal(r.metric.window_seconds, 604800);
});

test('R27: CTR-05 tanpa sekuens terverifikasi tetap jujur (bukan dipaksa TRIGGERED oleh window)', () => {
  const t0 = 1700000000;
  const events = [
    // transfer + sell TANPA relationship_verified -> bukan sekuens terverifikasi
    { wallet: 'WalletCTR27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', event: { event_class: 'RECEIVE', signature: 't-norel', block_time: t0, counterparty: 'Funder27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } },
    { wallet: 'WalletCTR27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', event: { event_class: 'SELL', signature: 's-norel', block_time: t0 + 10800 } },
  ];
  const r = p9.evaluateRule('CTR-05', 'COORDINATED_TRADING_RISK', ctr05Rule,
    { events, phase8: { wallets: [] }, phase4: {}, rules });
  assert.notEqual(r.status, 'TRIGGERED');
});

// ---------- LTR-02: 2 snapshot berjarak 9 jam (scan-1 -> scan-2) sudah cukup ----------

function ltr02History(oldRaw, newRaw) {
  return [
    { snapshot_utc: '2026-10-27T02:00:00.000Z', pools: [{ pool: 'Pool27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', base: { amount_raw: oldRaw } }] },
    { snapshot_utc: '2026-10-27T11:00:00.000Z', pools: [{ pool: 'Pool27AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', base: { amount_raw: newRaw } }] },
  ];
}

test('R27: LTR-02 TRIGGERED pada penurunan 30% antar 2 snapshot berjarak 9 jam; NOT_TRIGGERED pada 10%', () => {
  const trig = p9.evaluateRule('LTR-02', 'LIQUIDITY_RELATED_TRADING_RISK', ltr02Rule,
    { liquidityHistory: ltr02History('1000', '700'), rules });
  assert.equal(trig.status, 'TRIGGERED');
  assert.equal(trig.metric.snapshots_available, 2);
  assert.equal(trig.metric.max_decline.interval_start_utc, '2026-10-27T02:00:00.000Z');
  assert.equal(trig.metric.max_decline.interval_end_utc, '2026-10-27T11:00:00.000Z');
  const ok = p9.evaluateRule('LTR-02', 'LIQUIDITY_RELATED_TRADING_RISK', ltr02Rule,
    { liquidityHistory: ltr02History('1000', '900'), rules });
  assert.equal(ok.status, 'NOT_TRIGGERED');
});

test('R27: LTR-02 dengan <2 snapshot tetap INSUFFICIENT (tidak diinterpolasi)', () => {
  const r = p9.evaluateRule('LTR-02', 'LIQUIDITY_RELATED_TRADING_RISK', ltr02Rule,
    { liquidityHistory: ltr02History('1000', '700').slice(0, 1), rules });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
});
