'use strict';
/* merge_config.js — Tambah section config yang hilang TANPA menyentuh nilai
 * yang sudah ada (terutama helius.api_key). Idempoten: aman dijalankan
 * berulang kali. Jalankan sekali dari folder project:  node merge_config.js
 */
const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, 'Config', 'config.json');
const CFG_EXAMPLE = path.join(__dirname, 'Config', 'config.json.example');
const added = [];

// Clone baru / langkah setup dilewati: config.json bisa belum ada.
// Seed dari example (atau objek kosong) agar tidak crash ENOENT.
const c = (() => {
  if (fs.existsSync(CFG)) return JSON.parse(fs.readFileSync(CFG, 'utf8'));
  const seed = fs.existsSync(CFG_EXAMPLE) ? fs.readFileSync(CFG_EXAMPLE, 'utf8') : '{}\n';
  fs.writeFileSync(CFG, seed, 'utf8');
  added.push('Config/config.json (seeded from example)');
  return JSON.parse(seed);
})();

function ensure(obj, key, value, label) {
  if (obj[key] === undefined) { obj[key] = value; added.push(label); }
}
function ensureDeep(obj, key, sub, label) {
  if (obj[key] === undefined) obj[key] = {};
  for (const [k, v] of Object.entries(sub)) {
    if (obj[key][k] === undefined) { obj[key][k] = v; added.push(`${label}.${k}`); }
  }
}

// Ronde 13 (permintaan Rin 2026-10-13): throttle global Helius RPC.
// Satu section untuk mengatur laju request ke Helius dari SEMUA phase &
// kolektor. min_interval_ms=110 -> ~9 request/detik, aman di bawah limit
// 10/dtk. Saat memakai API key asli, naikkan kecepatan dengan MENURUNKAN
// angka ini (mis. 60), atau naikkan bila masih kena 429 (mis. 200).
// Modul yang sudah punya interval sendiri (phase8.min_request_interval_ms,
// market_volume.delay_ms, funding_graph.min_request_interval_ms) tetap
// memakai nilainya sebagai override; section ini menjadi default global.
ensure(c, 'rpc_throttle', {
  min_interval_ms: 110,
  max_delay_ms: 30000,
  retryable_statuses: [408, 429, 500, 502, 503, 504],
}, 'rpc_throttle');

// Ronde 12 (keputusan Rin 2026-10-13, B1): guard kredibilitas likuiditas
ensure(c, 'evaluation_guards', { liquidity_credibility_ratio: 0.01 }, 'evaluation_guards');
ensure(c, 'score_gate', { enabled: true, max_insufficient_ratio: 1 / 3, tier_cap: 3 }, 'score_gate');

// Ronde 8: setting kolektor market-volume
// Ronde 11b: tambah concurrency (worker pool) — deep-ensure agar yang sudah
// punya section market_volume tetap dapat key baru ini.
if (!c.market_volume || typeof c.market_volume !== 'object') c.market_volume = {};
for (const [k, v] of Object.entries({
  max_tx: 1500, delay_ms: 300, page_limit: 1000,
  retry_passes: 2, retry_delay_ms: 1500, timeout_ms: 25000, concurrency: 3,
})) {
  if (c.market_volume[k] === undefined) { c.market_volume[k] = v; added.push(`market_volume.${k}`); }
}

// Ronde 10: modifier emoji (digabung ke scoring.modifiers bila sudah ada)
if (!c.scoring || typeof c.scoring !== 'object') c.scoring = {};
if (!c.scoring.modifiers || typeof c.scoring.modifiers !== 'object') {
  c.scoring.modifiers = {};
  added.push('scoring.modifiers');
}
// pastikan tiap key modifier ada
for (const [k, v] of Object.entries({ star: 5, priority: 2, flag: -5, blocked: -10 })) {
  if (c.scoring.modifiers[k] === undefined) { c.scoring.modifiers[k] = v; added.push(`scoring.modifiers.${k}`); }
}

// Ronde 10: database_conviction (Opsi B)
ensure(c, 'database_conviction', {
  min_matched_wallets: 3,
  db_total_wallets: 1143,
  sell_cluster_window_seconds: 3600,
  fast_exit_hours: 72,
  conviction_scale: 50,
  adjustment_clamp: [-15, 15],
  holder_distribution: { retention_weight: 10, conviction_weight: 5 },
  risk_findings: { coordinated_sell_weight: 12, fast_exit_weight: 8, negative_conviction_weight: 10 },
  creator_activity: { bundler_overlap_weight: 10 },
  token_control: { dev_concentration_weight: 8 },
}, 'database_conviction');
// 2026-10-13: samakan db_total_wallets dengan jumlah aktual Data/database-wallet.json
// (penyebut penetrasi harus jujur mengikuti ukuran DB).
try {
  const dbCount = JSON.parse(fs.readFileSync(path.join(__dirname, 'Data', 'database-wallet.json'), 'utf8')).length;
  if (Number.isInteger(dbCount) && dbCount > 0 && c.database_conviction.db_total_wallets !== dbCount) {
    c.database_conviction.db_total_wallets = dbCount;
    added.push(`database_conviction.db_total_wallets=${dbCount}`);
  }
} catch { /* DB tidak terbaca — biarkan nilai yang ada */ }

// Ronde 11: jalur data CTR-05
ensure(c, 'relationships', {
  enabled: true,
  note: 'Jalur data CTR-05: anotasi relationship dari funding-graph.json (shared funder). false = matikan anotasi.',
}, 'relationships');

fs.writeFileSync(CFG, JSON.stringify(c, null, 2) + '\n', 'utf8');
if (added.length) console.log('Ditambahkan: ' + added.join(', '));
else console.log('Semua section sudah ada — tidak ada yang diubah.');
console.log('helius.api_key tidak disentuh.');
