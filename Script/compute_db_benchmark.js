#!/usr/bin/env node
'use strict';

/**
 * STI — DB Benchmark Calculator (Ronde 14)
 *
 * Menghitung NILAI STANDAR wallet DB dari sekumpulan hasil scan:
 * untuk setiap CA, total skor DB = Σ bobot positif wallet DB yang match
 * − Σ |bobot negatif| (bobot = role_weight + modifier emoji, persis seperti
 * `database.total_database_weight` di phase7-result.json).
 *
 * Standar = rata-rata total skor lintas CA. Pita kuning = standar
 * ± (band_fraction × rentang distribusi [max − min]); keputusan Rin
 * 2026-10-20: band_fraction = 5% dari rentang (bukan dari standar, karena
 * standar hasil batch 1 ≈ +0.95 — pita ±5% dari standar tidak bermakna).
 *
 * Hasil ditulis ke Data/db_benchmark.json dan dibaca wallet_db_report.js.
 * Jalankan ulang kapan pun setelah batch scan baru terkumpul:
 *   node Script/compute_db_benchmark.js [--output-root <dir>] [--out <file>]
 * Default output-root = Output/ proyek ini; default out = Data/db_benchmark.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION = '1.0.0';
const BAND_FRACTION = 0.05; // 5% dari rentang distribusi (keputusan Rin 2026-10-20)

function computeTotalFromMatches(matches) {
  let positive = 0;
  let negative = 0;
  let holders = 0;
  for (const m of Array.isArray(matches) ? matches : []) {
    const w = Number(m?.database?.total_database_weight) || 0;
    if (w > 0) positive += w;
    else if (w < 0) negative += -w;
    if (m?.current?.is_holder) holders++;
  }
  return { positive, negative, total: positive - negative, matched: (matches || []).length, holders };
}

function computeBenchmark(outputRoot) {
  const dirs = fs.existsSync(outputRoot)
    ? fs.readdirSync(outputRoot, { withFileTypes: true }).filter(d => d.isDirectory())
    : [];
  const perCa = [];
  for (const d of dirs) {
    const file = path.join(outputRoot, d.name, 'phase7-result.json');
    if (!fs.existsSync(file)) continue;
    let p7;
    try { p7 = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const t = computeTotalFromMatches(p7.matches);
    let symbol = null;
    try {
      const p1 = JSON.parse(fs.readFileSync(path.join(outputRoot, d.name, 'phase1-result.json'), 'utf8'));
      symbol = p1?.token?.symbol || null;
    } catch { /* simbol opsional */ }
    perCa.push({ mint: d.name, symbol, scanned_at: p7.generated_at || p7.timestamp || null, ...t });
  }
  if (!perCa.length) return null;

  const totals = perCa.map(x => x.total).sort((a, b) => a - b);
  const n = totals.length;
  const sum = totals.reduce((s, x) => s + x, 0);
  const standard = sum / n;
  const min = totals[0];
  const max = totals[n - 1];
  const range = max - min;
  const median = n % 2 ? totals[(n - 1) / 2] : (totals[n / 2 - 1] + totals[n / 2]) / 2;
  const bandWidth = BAND_FRACTION * range;

  return {
    version: VERSION,
    generated_at: new Date().toISOString(),
    method: 'total per CA = Σ bobot positif − Σ |bobot negatif| dari database.total_database_weight (phase 7); standar = rata-rata lintas CA; pita kuning = standar ± 5% × (max − min) — keputusan Rin 2026-10-20',
    sample: {
      ca_count: n,
      output_root: outputRoot,
      scanned_from: perCa.map(x => x.scanned_at).filter(Boolean).sort()[0] || null,
      scanned_to: perCa.map(x => x.scanned_at).filter(Boolean).sort().slice(-1)[0] || null,
    },
    standard: +standard.toFixed(4),
    median: +median.toFixed(4),
    min,
    max,
    range,
    band_fraction: BAND_FRACTION,
    band_width: +bandWidth.toFixed(4),
    yellow_low: +(standard - bandWidth).toFixed(4),
    yellow_high: +(standard + bandWidth).toFixed(4),
    per_ca: perCa.sort((a, b) => b.total - a.total),
  };
}

function classifyTotal(total, benchmark) {
  if (!benchmark || !Number.isFinite(benchmark.standard) || !Number.isFinite(benchmark.band_width)) return 'UNKNOWN';
  if (total > benchmark.standard + benchmark.band_width) return 'GREEN';
  if (total < benchmark.standard - benchmark.band_width) return 'RED';
  return 'YELLOW';
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const outputRoot = path.resolve(opt('--output-root', path.join(ROOT, 'Output')));
  const outFile = path.resolve(opt('--out', path.join(ROOT, 'Data', 'db_benchmark.json')));
  const benchmark = computeBenchmark(outputRoot);
  if (!benchmark) {
    console.error(`Tidak ada phase7-result.json di ${outputRoot} — benchmark tidak dibuat.`);
    process.exitCode = 1;
  } else {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(benchmark, null, 2) + '\n', 'utf8');
    console.log(`Benchmark dari ${benchmark.sample.ca_count} CA -> ${outFile}`);
    console.log(`standar=${benchmark.standard} median=${benchmark.median} min=${benchmark.min} max=${benchmark.max} rentang=${benchmark.range}`);
    console.log(`pita kuning: ${benchmark.yellow_low} s.d. ${benchmark.yellow_high} (di atas = HIJAU, di bawah = MERAH)`);
  }
}

module.exports = { computeTotalFromMatches, computeBenchmark, classifyTotal, BAND_FRACTION, VERSION };
