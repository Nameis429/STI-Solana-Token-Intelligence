#!/usr/bin/env node
'use strict';

/**
 * STI — Wallet DB HTML Report (Ronde 14, menu 13)
 *
 * Report KHUSUS wallet DB, terpisah dari report.html utama.
 * Sumber: Output/<mint>/phase7-result.json (+ phase1 untuk identitas token)
 * dan Data/db_benchmark.json (nilai standar; buat/refresh lewat
 * Script/compute_db_benchmark.js).
 *
 * Isi:
 *  1. Total skor DB token ini: Σ bobot positif − Σ |bobot negatif| dari
 *     wallet DB yang match, dibandingkan ke nilai standar:
 *     di atas pita = HIJAU, di dalam pita (±5% rentang distribusi) =
 *     KUNING, di bawah pita = MERAH. (Keputusan Rin 2026-10-20.)
 *  2. Daftar wallet DB yang sedang HOLD (saldo, % supply, durasi hold).
 *  3. Daftar wallet DB yang pernah membeli / menerima token ini.
 *  4. Wallet DB paling aktif (buy, sell, flow in/out, total event).
 *
 * Presentation only terhadap data phase 7 — bobot wallet diambil apa
 * adanya dari `database.total_database_weight` (role + modifier emoji).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { computeTotalFromMatches, classifyTotal } = require('./compute_db_benchmark');

const ROOT = path.join(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'Output');
const BENCHMARK_FILE = path.join(ROOT, 'Data', 'db_benchmark.json');
const VERSION = '1.0.0';

const readJson = file => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};
const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const num = (value, digits = 2) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
};
const short = (value, chars = 6) => {
  const s = String(value ?? '');
  return s.length > chars * 2 + 1 ? `${s.slice(0, chars)}…${s.slice(-chars)}` : s;
};
const safeArray = v => (Array.isArray(v) ? v : []);

function formatWIB(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d).replace(',', '') + ' WIB';
}

function formatDuration(fromTs, toTs) {
  if (!fromTs || !toTs) return 'N/A';
  const a = new Date(fromTs).getTime();
  const b = new Date(toTs).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 'N/A';
  const mins = Math.floor((b - a) / 60000);
  if (mins < 1) return '< 1 mnt';
  if (mins < 60) return `${mins} mnt`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam ${mins % 60} mnt`;
  const days = Math.floor(hours / 24);
  return `${days} hari ${hours % 24} jam`;
}

function walletRowBase(m) {
  const db = m?.database || {};
  return {
    wallet: m?.wallet || '',
    name: db.name || m?.display || '',
    roles: safeArray(db.roles).join(', ') || 'DEFAULT',
    modifiers: safeArray(db.modifiers).join(' '),
    weight: Number(db.total_database_weight) || 0,
    roleWeight: db.role_weight ?? null,
    modifierWeight: db.modifier_weight ?? null,
  };
}

function buildHtml({ mint, dir, p1, p7, benchmark }) {
  const matches = safeArray(p7?.matches);
  const totals = computeTotalFromMatches(matches);
  const cls = classifyTotal(totals.total, benchmark);
  const symbol = p1?.token?.symbol || '?';
  const name = p1?.token?.name || '';
  const dbSize = p7?.database?.wallet_count ?? 'N/A';
  const scanTime = p7?.generated_at || p7?.timestamp || null;

  const clsMeta = {
    GREEN: { label: 'DI ATAS STANDAR', bg: '#dafbe1', fg: '#116329', border: '#1a7f37' },
    YELLOW: { label: 'SEKITAR STANDAR', bg: '#fff8c5', fg: '#7d4e00', border: '#bf8700' },
    RED: { label: 'DI BAWAH STANDAR', bg: '#ffebe9', fg: '#82071e', border: '#cf222e' },
    UNKNOWN: { label: 'STANDAR BELUM TERSEDIA', bg: '#f0f0f0', fg: '#444', border: '#888' },
  }[cls];

  // --- Tabel 1: holders
  const holders = matches
    .filter(m => m?.current?.is_holder)
    .map(m => ({
      ...walletRowBase(m),
      balance: m.current.balance_ui,
      supplyPct: m.current.supply_percentage != null ? m.current.supply_percentage * 100 : null,
      rank: m.current.holder_rank ?? null,
      since: m?.history?.first_acquisition?.timestamp || null,
      last: m?.history?.last_interaction?.timestamp || null,
    }))
    .sort((a, b) => (b.balance || 0) - (a.balance || 0));

  // --- Tabel 2: pernah membeli / menerima
  const buyers = matches
    .filter(m => (m?.history?.buy_count || 0) > 0 || (m?.history?.receive_count || 0) > 0)
    .map(m => ({
      ...walletRowBase(m),
      buy: m.history.buy_count || 0,
      receive: m.history.receive_count || 0,
      first: m?.history?.first_interaction?.timestamp || null,
      still: !!m?.current?.is_holder,
    }))
    .sort((a, b) => (b.buy + b.receive) - (a.buy + a.receive));

  // --- Tabel 3: paling aktif
  const active = matches
    .map(m => {
      const h = m?.history || {};
      const buy = h.buy_count || 0;
      const sell = h.sell_count || 0;
      const receive = h.receive_count || 0;
      const outbound = h.outbound_count || 0;
      return { ...walletRowBase(m), buy, sell, receive, outbound, events: buy + sell + receive + outbound, txs: h.transactions ?? null, still: !!m?.current?.is_holder };
    })
    .filter(x => x.events > 0)
    .sort((a, b) => b.events - a.events)
    .slice(0, 25);

  const wcell = w => `<td class="mono" title="${esc(w.wallet)}">${esc(short(w.wallet))}</td>
      <td>${esc(w.name)}</td><td>${esc(w.roles)}${w.modifiers ? ' ' + esc(w.modifiers) : ''}</td>
      <td class="r">${w.weight > 0 ? '+' : ''}${w.weight}</td>`;

  const holdersRows = holders.map(h => `<tr>${wcell(h)}
      <td class="r">${num(h.balance)}</td><td class="r">${h.supplyPct != null ? num(h.supplyPct, 4) + '%' : 'N/A'}</td>
      <td class="r">${h.rank ?? 'N/A'}</td><td>${formatWIB(h.since)}</td>
      <td>${esc(formatDuration(h.since, h.last || scanTime))}</td></tr>`).join('\n')
    || '<tr><td colspan="9" class="empty">Tidak ada wallet DB yang sedang hold.</td></tr>';

  const buyersRows = buyers.map(b => `<tr>${wcell(b)}
      <td class="r">${b.buy}</td><td class="r">${b.receive}</td><td>${formatWIB(b.first)}</td>
      <td>${b.still ? 'Masih hold' : 'Sudah keluar'}</td></tr>`).join('\n')
    || '<tr><td colspan="8" class="empty">Tidak ada wallet DB yang tercatat membeli / menerima.</td></tr>';

  const activeRows = active.map(a => `<tr>${wcell(a)}
      <td class="r">${a.buy}</td><td class="r">${a.sell}</td><td class="r">${a.receive}</td>
      <td class="r">${a.outbound}</td><td class="r"><b>${a.events}</b></td><td class="r">${a.txs ?? 'N/A'}</td>
      <td>${a.still ? 'Masih hold' : 'Sudah keluar'}</td></tr>`).join('\n')
    || '<tr><td colspan="11" class="empty">Tidak ada event wallet DB yang tercatat.</td></tr>';

  const benchInfo = benchmark
    ? `<p class="small">Nilai standar <b>${num(benchmark.standard)}</b> dari ${benchmark.sample?.ca_count ?? '?'} CA acak
       (rentang ${benchmark.min} s.d. ${benchmark.max}; pita kuning ${num(benchmark.yellow_low)} s.d. ${num(benchmark.yellow_high)}).
       Benchmark dibuat ${formatWIB(benchmark.generated_at)}.</p>`
    : `<p class="small">File <span class="mono">Data/db_benchmark.json</span> tidak ditemukan — total ditampilkan tanpa
       perbandingan standar. Buat lewat <span class="mono">node Script/compute_db_benchmark.js</span>.</p>`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wallet DB Report — ${esc(symbol)} (${esc(short(mint))})</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #1f2328; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 8px; }
  .small { color: #57606a; font-size: 13px; } .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .banner { border: 2px solid ${clsMeta.border}; background: ${clsMeta.bg}; color: ${clsMeta.fg};
    border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
  .banner .score { font-size: 34px; font-weight: 700; }
  .banner .label { font-size: 15px; font-weight: 600; letter-spacing: .4px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f6f8fa; } td.r, th.r { text-align: right; } td.empty { text-align: center; color: #57606a; }
  .grid { display: flex; gap: 24px; flex-wrap: wrap; } .grid div b { font-size: 18px; }
</style>
</head>
<body>
<h1>Wallet DB Report — ${esc(symbol)}${name && name !== symbol ? ` (${esc(name)})` : ''}</h1>
<p class="small">Mint: <span class="mono">${esc(mint)}</span> · Scan phase 7: ${formatWIB(scanTime)} ·
Ukuran DB: ${dbSize} wallet · Wallet DB yang match: ${totals.matched} · Sedang hold: ${totals.holders}</p>

<div class="banner">
  <div class="label">TOTAL SKOR WALLET DB — ${clsMeta.label}</div>
  <div class="score">${totals.total > 0 ? '+' : ''}${totals.total}</div>
  <div>Σ nilai positif <b>${totals.positive}</b> − Σ nilai negatif <b>${totals.negative}</b> = <b>${totals.total}</b></div>
</div>
${benchInfo}

<h2>1 · Wallet DB yang sedang HOLD (${holders.length})</h2>
<table>
<tr><th>Wallet</th><th>Nama</th><th>Role / Emoji</th><th class="r">Bobot</th><th class="r">Saldo (token)</th><th class="r">% Supply</th><th class="r">Rank</th><th>Pertama beli/terima</th><th>Durasi hold*</th></tr>
${holdersRows}
</table>
<p class="small">*Durasi hold = dari akuisisi pertama sampai interaksi terakhir tercatat (atau waktu scan bila masih aktif).</p>

<h2>2 · Wallet DB yang pernah MEMBELI / MENERIMA (${buyers.length})</h2>
<table>
<tr><th>Wallet</th><th>Nama</th><th>Role / Emoji</th><th class="r">Bobot</th><th class="r">Beli</th><th class="r">Terima</th><th>Interaksi pertama</th><th>Status kini</th></tr>
${buyersRows}
</table>

<h2>3 · Wallet DB PALING AKTIF (maks 25)</h2>
<table>
<tr><th>Wallet</th><th>Nama</th><th>Role / Emoji</th><th class="r">Bobot</th><th class="r">Buy</th><th class="r">Sell</th><th class="r">Flow in</th><th class="r">Flow out</th><th class="r">Total event</th><th class="r">Transaksi</th><th>Status kini</th></tr>
${activeRows}
</table>

<h2>Metode</h2>
<p class="small">Bobot wallet = bobot role (DEFAULT 1, early 2, Whale 3, Dev −1, Rug/Kol −2) + modifier emoji
(🚫 −10, 🚩 −5, 💚 +2, ⭐ +5), diambil apa adanya dari phase 7 (<span class="mono">total_database_weight</span>).
Total skor tidak membedakan perilaku — ia murni akumulasi bobot wallet DB yang bersentuhan dengan token ini;
rincian perilakunya ada di tabel 1–3 dan di adjustment Phase 11. Nilai standar berasal dari distribusi total skor
CA acak (lihat benchmark); pita kuning = standar ± 5% × rentang distribusi (keputusan Rin 2026-10-20).
Report ini presentasi saja dan tidak mengubah skor Phase 11. · wallet_db_report v${VERSION}</p>
</body>
</html>
`;
}

function generateWalletDbReport(mint, opts = {}) {
  if (!mint) throw new Error('Mint wajib diisi untuk wallet DB report.');
  const dir = path.join(OUTPUT_ROOT, mint);
  if (!fs.existsSync(dir)) throw new Error(`Output mint tidak ditemukan: ${mint}`);
  const p7 = readJson(path.join(dir, 'phase7-result.json'));
  if (!p7) throw new Error(`phase7-result.json tidak ditemukan / rusak untuk mint ${mint}`);
  const p1 = readJson(path.join(dir, 'phase1-result.json'));
  const benchmark = opts.benchmark !== undefined ? opts.benchmark : readJson(BENCHMARK_FILE);
  const html = buildHtml({ mint, dir, p1, p7, benchmark });
  const out = path.join(dir, 'wallet-db-report.html');
  fs.writeFileSync(out, html, 'utf8');
  return { out, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex') };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const mi = args.indexOf('--mint');
  const mint = mi >= 0 ? args[mi + 1] : args[0];
  try {
    const result = generateWalletDbReport(mint);
    console.log(`Wallet DB report disimpan: ${result.out}`);
    console.log(`SHA-256: ${result.sha256}`);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { generateWalletDbReport, buildHtml, formatDuration, VERSION };
