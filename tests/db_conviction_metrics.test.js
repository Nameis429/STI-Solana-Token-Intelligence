'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dbm = require(path.join(root, 'Script/db_conviction_metrics.js'));
const p11 = require(path.join(root, 'Script/phase11_final_report.js'));

const T0 = 1700000000;
function mkWallet(addr, o = {}) {
  const ev = [];
  for (const t of (o.buys || [])) ev.push({ event_class: 'BUY', block_time: t });
  for (const t of (o.sells || [])) ev.push({ event_class: 'SELL', block_time: t });
  return {
    wallet: addr,
    display: o.name || addr.slice(0, 6),
    database: { matched: true, name: o.name || null, roles: o.roles || ['DEFAULT'],
      role_weight: o.weight || 0, modifier_weight: 0, total_database_weight: o.weight || 0 },
    current: { is_holder: o.holder ?? null, supply_percentage: o.supplyPct ?? null },
    history: { events: ev },
    position: { current_holder: o.holder ?? null,
      observed_activity_span_seconds: o.span ?? null,
      observed_buy_count: (o.buys || []).length, observed_sell_count: (o.sells || []).length },
  };
}
const CFG = { database_conviction: {} }; // pakai default

test('INSUFFICIENT_DATA bila match < min_matched_wallets', () => {
  const r = dbm.computeDbConviction({ wallets: [mkWallet('A1', { holder: true })], config: CFG });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.metrics, null);
});

test('penetrasi & retensi dihitung jujur', () => {
  const ws = [
    mkWallet('A1', { holder: true, roles: ['EARLY'], weight: 2 }),
    mkWallet('B2', { holder: true, roles: ['WHALE'], weight: 3 }),
    mkWallet('C3', { holder: false, roles: ['DEV'], weight: -1, buys: [T0], sells: [T0 + 100] }),
    mkWallet('D4', { holder: null, roles: ['DEFAULT'], weight: 1 }), // posisi tak diketahui -> di luar retention
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.status, 'OK');
  assert.equal(r.metrics.penetration.matched, 4);
  assert.equal(r.metrics.penetration.share_of_db, Math.round(4 / 1143 * 100) / 100);
  assert.equal(r.metrics.retention.rate, 0.67); // 2/3 known
  assert.equal(r.metrics.retention.known, 3);
});

test('coordinated_sell: sell bergerombol dalam window terdeteksi', () => {
  const ws = [
    mkWallet('A1', { holder: false, buys: [T0], sells: [T0 + 100] }),
    mkWallet('B2', { holder: false, buys: [T0], sells: [T0 + 200] }),
    mkWallet('C3', { holder: false, buys: [T0], sells: [T0 + 300] }),
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.metrics.coordinated_sell.cluster_wallets, 3);
  assert.equal(r.metrics.coordinated_sell.rate, 1);
});

test('coordinated_sell: sell tersebar tidak dianggap koordinasi', () => {
  const ws = [
    mkWallet('A1', { holder: false, buys: [T0], sells: [T0] }),
    mkWallet('B2', { holder: false, buys: [T0], sells: [T0 + 86400] }),
    mkWallet('C3', { holder: false, buys: [T0], sells: [T0 + 172800] }),
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.metrics.coordinated_sell.cluster_wallets, 1);
  assert.equal(r.metrics.coordinated_sell.rate, 0.33);
});

test('fast_exit: beli -> jual habis cepat -> menghilang', () => {
  const ws = [
    mkWallet('A1', { holder: false, buys: [T0], sells: [T0 + 3600] }), // 1 jam -> fast
    mkWallet('B2', { holder: true, buys: [T0], sells: [T0 + 3600] }),  // masih holder -> bukan
    mkWallet('C3', { holder: false, buys: [T0], sells: [T0 + 400000] }), // >72 jam -> bukan
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.metrics.fast_exit.wallets, 1);
  assert.equal(r.metrics.fast_exit.rate, 0.33);
});

test('conviction: net bobot holder minus exited, dinormalisasi', () => {
  const ws = [
    mkWallet('A1', { holder: true, weight: 5 }),
    mkWallet('B2', { holder: false, weight: -12 }),
    mkWallet('C3', { holder: false, weight: 0 }),
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.metrics.conviction.net_weight, 17); // 5 - (-12)
  assert.equal(r.metrics.conviction.normalized, 0.34); // 17/50
});

test('conviction negatif ternormalisasi ke [-1,0]', () => {
  const ws = [
    mkWallet('A1', { holder: true, weight: -2 }),
    mkWallet('B2', { holder: false, weight: 3 }),
    mkWallet('C3', { holder: false, weight: 0 }),
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.metrics.conviction.net_weight, -5); // -2 - 3
  assert.equal(r.metrics.conviction.normalized, -0.1);
});

test('bundler_overlap: wallet DB di kandidat bundler Phase 5', () => {
  const ws = [mkWallet('A1', { holder: true }), mkWallet('B2', { holder: true }), mkWallet('C3', { holder: true })];
  const p5 = { initial_distribution: { bundler_candidates: [{ wallets: ['A1', 'XXX'] }] } };
  const r = dbm.computeDbConviction({ wallets: ws, p5, config: CFG });
  assert.equal(r.metrics.bundler_overlap.wallets, 1);
  assert.equal(r.metrics.bundler_overlap.rate, 0.33);
});

test('dev_concentration: null bila tidak ada data supply DEV', () => {
  const ws = [mkWallet('A1', { holder: true, roles: ['DEV'], weight: -1 })];
  const ws3 = [...ws, mkWallet('B2', { holder: true }), mkWallet('C3', { holder: true })];
  const r = dbm.computeDbConviction({ wallets: ws3, config: CFG });
  assert.equal(r.metrics.dev_concentration, null);
});

test('dev_concentration: menjumlah % supply wallet DEV', () => {
  const ws = [
    mkWallet('A1', { holder: true, roles: ['DEV'], weight: -1, supplyPct: 2.5 }),
    mkWallet('B2', { holder: true, roles: ['EARLY'], weight: 2, supplyPct: 1.0 }),
    mkWallet('C3', { holder: true }),
  ];
  const r = dbm.computeDbConviction({ wallets: ws, config: CFG });
  assert.equal(r.metrics.dev_concentration.dev_supply_pct, 2.5);
});

test('applyDbAdjustments: clamp per-dimensi [-15,15]', () => {
  // Keputusan Rin 2026-10-13 (D1): holder_distribution tidak lagi menerima
  // komponen DB — uji clamp memakai risk_findings.
  const dims = [{ id: 'risk_findings', score: 60, available: true, reason: 'base', details: {} }];
  const fakeDbm = { status: 'OK', matched_count: 3, metrics: {
    retention: { rate: 1, holders: 3, known: 3 }, conviction: { normalized: -1, net_weight: -50 },
    coordinated_sell: { rate: 1 }, fast_exit: { rate: 1 }, bundler_overlap: { rate: 0 }, dev_concentration: null } };
  const out = dbm.applyDbAdjustments(dims, fakeDbm,
    { database_conviction: { risk_findings: { coordinated_sell_weight: 100, fast_exit_weight: 100, negative_conviction_weight: 100 } } });
  // raw = -100*1 -100*1 + 100*(-1) = -300 -> clamp -15
  assert.equal(out[0].details.db_adjustment.total_points, -15);
  assert.equal(out[0].score, 45);
});

test('applyDbAdjustments: tanpa data -> skor tidak berubah, alasan jujur', () => {
  const dims = [{ id: 'risk_findings', score: 60, available: true, reason: 'base', details: {} }];
  const noData = { status: 'INSUFFICIENT_DATA', reason: 'kurang', matched_count: 1, metrics: null };
  const out = dbm.applyDbAdjustments(dims, noData, CFG);
  assert.equal(out[0].score, 60);
  assert.equal(out[0].details.db_adjustment.applied, false);
});

test('applyDbAdjustments: fee_utility tidak pernah diadjust', () => {
  const dims = [{ id: 'fee_utility', score: 70, available: true, reason: 'base', details: {} }];
  const fakeDbm = { status: 'OK', matched_count: 3, metrics: {
    retention: { rate: 1, holders: 3, known: 3 }, conviction: { normalized: 1, net_weight: 50 },
    coordinated_sell: { rate: 1 }, fast_exit: { rate: 1 }, bundler_overlap: { rate: 1 },
    dev_concentration: { dev_supply_pct: 20, dev_wallets: 1 } } };
  const out = dbm.applyDbAdjustments(dims, fakeDbm, CFG);
  assert.equal(out[0].score, 70);
  assert.deepEqual(out[0].details.db_adjustment.components, []);
});

function phase11Fixture() {
  const ws = [
    mkWallet('addrA', { name: 'Early-1', holder: true, roles: ['EARLY'], weight: 2, supplyPct: 1.0, buys: [T0] }),
    mkWallet('addrB', { name: 'D-1', holder: false, roles: ['DEV'], weight: -1, buys: [T0], sells: [T0 + 1800, T0 + 2400], span: 2400 }),
    mkWallet('addrC', { name: 'Rug-1', holder: false, roles: ['RUG/KOL'], weight: -2, buys: [T0 + 100], sells: [T0 + 2000], span: 1900 }),
  ];
  return {
    2: { authority: { mint: { status: 'REVOKED' }, freeze: { status: 'REVOKED' } } },
    4: { concentration: { adjusted_confirmed_normal: { top_10: { share_of_total_supply_pct: 25 } } } },
    5: { creator_events: { sell: { status: 'NO_SELL_OBSERVED_WITHIN_COVERAGE', sell_count: 0 } },
      initial_distribution: { bundler_candidates: [{ wallets: ['addrA', 'zzz'] }] } },
    6: null,
    7: { matches: ws.map(w => ({ wallet: w.wallet })) },
    8: { wallets: ws, summary: {} },
    10: { evidence_groups: [{ risk: { score: 40 } }] },
  };
}

test('Phase11 Opsi B: adjustment DB masuk tiap dimensi dengan angka yang bisa dilacak', () => {
  const dims = p11.scoreDimensions(phase11Fixture(), { dbConviction: {} });
  const byId = Object.fromEntries(dims.map(d => [d.id, d]));
  // holder: keputusan Rin 2026-10-13 (D1) — retention+conviction DIPINDAHKAN
  // KELUAR dari holder_distribution; tidak ada komponen DB -> skor tetap 75
  assert.equal(byId.holder_distribution.details.db_adjustment.applied, false);
  assert.equal(byId.holder_distribution.details.db_adjustment.total_points, 0);
  assert.equal(byId.holder_distribution.score, 75);
  // risk: base 60; coord 2/3 -> 0.67 -> -8.04; fast 0.67 -> -5.36; negconv 0 -> total -13.4
  assert.equal(byId.risk_findings.details.db_adjustment.total_points, -13.4);
  assert.equal(byId.risk_findings.score, 46.6);
  // creator: base 65; bundler 1/3 -> 0.33 -> -3.3
  assert.equal(byId.creator_activity.details.db_adjustment.total_points, -3.3);
  assert.equal(byId.creator_activity.score, 61.7);
  // token_control: base 100; tidak ada supply DEV -> tidak diubah
  assert.equal(byId.token_control.score, 100);
  assert.equal(byId.token_control.details.db_adjustment.applied, false);
  // fee_utility tidak tersedia -> dilewati
  assert.equal(byId.fee_utility.available, false);
});

test('Phase11: tanpa data Phase 7/8 -> skor identik dengan sebelum Opsi B', () => {
  const p = phase11Fixture();
  delete p[7]; delete p[8];
  const dims = p11.scoreDimensions(p, { dbConviction: {} });
  const byId = Object.fromEntries(dims.map(d => [d.id, d]));
  assert.equal(byId.holder_distribution.score, 75);
  assert.equal(byId.risk_findings.score, 60);
  assert.equal(byId.creator_activity.score, 65);
  assert.equal(byId.token_control.score, 100);
  for (const d of dims) assert.equal(d.details.db_adjustment.applied, false);
});

test('Phase11: skor tidak pernah keluar dari [0,100]', () => {
  const dims = p11.scoreDimensions(phase11Fixture(), { dbConviction: {} });
  for (const d of dims) {
    if (d.available) assert.ok(d.score >= 0 && d.score <= 100, `${d.id}=${d.score}`);
  }
});
