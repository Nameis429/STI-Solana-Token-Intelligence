'use strict';
/* Ronde 14: report HTML khusus wallet DB (menu 13) + nilai standar.
 * Definisi Rin 2026-10-20: total skor DB per CA = Σ bobot positif
 * − Σ |bobot negatif| (bobot = database.total_database_weight phase 7).
 * Standar = rata-rata total lintas CA acak; pita kuning = standar
 * ± 5% × rentang distribusi (max − min). Di atas pita = HIJAU,
 * di bawah pita = MERAH, di dalam pita = KUNING. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const bench = require(path.join(root, 'Script/compute_db_benchmark.js'));
const report = require(path.join(root, 'Script/wallet_db_report.js'));

const M = (weight, extra = {}) => ({
  wallet: 'W' + Math.random().toString(36).slice(2, 10),
  database: { name: 't', roles: ['DEFAULT'], modifiers: [], role_weight: weight, modifier_weight: 0, total_database_weight: weight },
  current: { is_holder: false },
  history: {},
  ...extra,
});

test('computeTotalFromMatches: positif dikurang negatif', () => {
  const t = bench.computeTotalFromMatches([M(3), M(2), M(-7), M(-1), M(0), M(5, { current: { is_holder: true } })]);
  assert.equal(t.positive, 10);
  assert.equal(t.negative, 8);
  assert.equal(t.total, 2);
  assert.equal(t.matched, 6);
  assert.equal(t.holders, 1);
});

test('computeTotalFromMatches: matches kosong / bukan array aman', () => {
  assert.deepEqual(bench.computeTotalFromMatches([]), { positive: 0, negative: 0, total: 0, matched: 0, holders: 0 });
  assert.deepEqual(bench.computeTotalFromMatches(null), { positive: 0, negative: 0, total: 0, matched: 0, holders: 0 });
});

test('classifyTotal: hijau di atas pita, kuning di dalam, merah di bawah', () => {
  // standar 0.95, rentang 47 -> pita ±2.35 => kuning [-1.40, 3.30]
  const b = { standard: 0.95, band_width: 2.35 };
  assert.equal(bench.classifyTotal(19, b), 'GREEN');
  assert.equal(bench.classifyTotal(3.31, b), 'GREEN');
  assert.equal(bench.classifyTotal(3.30, b), 'YELLOW');
  assert.equal(bench.classifyTotal(0.95, b), 'YELLOW');
  assert.equal(bench.classifyTotal(-1.40, b), 'YELLOW');
  assert.equal(bench.classifyTotal(-1.41, b), 'RED');
  assert.equal(bench.classifyTotal(-28, b), 'RED');
});

test('classifyTotal: benchmark hilang -> UNKNOWN (jujur, bukan hijau)', () => {
  assert.equal(bench.classifyTotal(99, null), 'UNKNOWN');
  assert.equal(bench.classifyTotal(99, {}), 'UNKNOWN');
});

test('computeBenchmark: dari folder Output fixture', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sti-bench-'));
  const mk = (mint, weights) => {
    const dir = path.join(tmp, mint);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'phase7-result.json'), JSON.stringify({
      generated_at: '2026-10-20T00:00:00.000Z',
      matches: weights.map(w => M(w)),
    }));
    fs.writeFileSync(path.join(dir, 'phase1-result.json'), JSON.stringify({ token: { symbol: 'FIX' } }));
  };
  mk('MINT_A', [10, -5]);   // total 5
  mk('MINT_B', [3, -8]);    // total -5
  mk('MINT_C', [20, 0]);    // total 20
  const b = bench.computeBenchmark(tmp);
  assert.equal(b.sample.ca_count, 3);
  assert.equal(b.standard, +(20 / 3).toFixed(4)); // (5 + -5 + 20) / 3
  assert.equal(b.min, -5);
  assert.equal(b.max, 20);
  assert.equal(b.range, 25);
  assert.equal(b.band_width, 1.25); // 5% x 25
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('formatDuration: format jam/hari dan kasus tepi', () => {
  const t0 = '2026-10-20T00:00:00.000Z';
  assert.equal(report.formatDuration(t0, '2026-10-20T00:00:30.000Z'), '< 1 mnt');
  assert.equal(report.formatDuration(t0, '2026-10-20T05:30:00.000Z'), '5 jam 30 mnt');
  assert.equal(report.formatDuration(t0, '2026-10-22T03:00:00.000Z'), '2 hari 3 jam');
  assert.equal(report.formatDuration(null, t0), 'N/A');
  assert.equal(report.formatDuration('2026-10-21T00:00:00.000Z', t0), 'N/A'); // mundur
});

test('buildHtml: memuat total, label warna, dan tabel wallet', () => {
  const p7 = {
    generated_at: '2026-10-20T01:00:00.000Z',
    database: { wallet_count: 1143 },
    matches: [
      M(5, {
        wallet: 'HolderWallet1111111111111111111111111111111',
        current: { is_holder: true, balance_ui: 1234.5, supply_percentage: 0.001, holder_rank: 7 },
        history: { buy_count: 2, sell_count: 0, receive_count: 1, outbound_count: 0, transactions: 10,
          first_acquisition: { timestamp: '2026-10-19T01:00:00.000Z' },
          first_interaction: { timestamp: '2026-10-19T01:00:00.000Z' },
          last_interaction: { timestamp: '2026-10-20T01:00:00.000Z' } },
      }),
      M(-10),
    ],
  };
  const benchmark = { standard: 0.95, band_width: 2.35, yellow_low: -1.4, yellow_high: 3.3, min: -28, max: 19,
    generated_at: '2026-10-20T02:00:00.000Z', sample: { ca_count: 22 } };
  const html = report.buildHtml({ mint: 'MINTX', dir: '/tmp', p1: { token: { symbol: 'TST', name: 'Test' } }, p7, benchmark });
  assert.ok(html.includes('Wallet DB Report'));
  assert.ok(html.includes('-5')); // total = 5 - 10
  assert.ok(html.includes('DI BAWAH STANDAR')); // -5 < -1.40 -> MERAH
  assert.ok(html.includes('HolderWallet'));
  assert.ok(html.includes('1 hari 0 jam')); // durasi hold
});

test('buildHtml: tanpa benchmark -> label jujur, bukan crash', () => {
  const p7 = { database: { wallet_count: 10 }, matches: [M(3)] };
  const html = report.buildHtml({ mint: 'MINTY', dir: '/tmp', p1: null, p7, benchmark: null });
  assert.ok(html.includes('STANDAR BELUM TERSEDIA'));
  assert.ok(html.includes('compute_db_benchmark'));
});

test('Data/db_benchmark.json batch 1 konsisten dengan analisis 22 CA', () => {
  const file = path.join(root, 'Data', 'db_benchmark.json');
  assert.ok(fs.existsSync(file), 'benchmark batch 1 harus ada');
  const b = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(b.sample.ca_count, 22);
  assert.equal(b.standard, 0.9545);
  assert.equal(b.min, -28);
  assert.equal(b.max, 19);
  assert.equal(b.band_width, 2.35);
  const loulou = b.per_ca.find(x => x.total === -28);
  assert.ok(loulou, 'CA dengan total -28 (LouLou) harus ada di per_ca');
});
