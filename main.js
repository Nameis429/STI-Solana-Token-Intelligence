#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { generateReportHTML } = require('./Script/generate_html_report');
const { generateWalletDbReport } = require('./Script/wallet_db_report');
const { archivePreviousRun } = require('./Script/scan_history');
const ROOT = __dirname;
const SCRIPT_DIR = path.join(ROOT, 'Script');
const OUTPUT_DIR = path.join(ROOT, 'Output');
const PHASES = [
  { n: 1, title: 'phase token discovery', file: 'phase1_token_discovery.js' },
  { n: 2, title: 'phase token authority supply', file: 'phase2_token_authority_supply.js' },
  { n: 3, title: 'phase holder discovery', file: 'phase3_holder_discovery.js' },
  { n: 4, title: 'phase holder concentration', file: 'phase4_holder_concentration.js' },
  { n: 5, title: 'phase creator_dev_analysis', file: 'phase5_creator_dev_analysis.js' },
  { n: 6, title: 'phase fee trading economics', file: 'phase6_fee_trading_economics.js' },
  { n: 7, title: 'phase database wallet matching', file: 'phase7_database_wallet_matching.js' },
  { n: 8, title: 'phase wallet behavior timeline', file: 'phase8_wallet_behavior_timeline.js' },
  { n: 9, title: 'phase risk_engine', file: 'phase9_risk_engine.js' },
  { n: 10, title: 'phase scoring_engine', file: 'phase10_scoring_engine.js' },
  { n: 11, title: 'phase final_report', file: 'phase11_final_report.js' },
  { n: 12, title: 'phase early trader signals', file: 'phase12_early_signals.js' },
  { n: 14, title: 'funding graph collector (CTR-01/02)', file: 'collect_funding_graph.js' },
  { n: 15, title: 'market volume collector (SPR-03/CTR-04/TCR-01/02/03)', file: 'collect_market_volume.js' },
];
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, a => resolve(String(a || '').trim())));
const short = s => s.length > 20 ? `${s.slice(0, 8)}...${s.slice(-8)}` : s;
function validMint(s) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s); }
function banner() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       SOLANA TOKEN INTELLIGENCE — DAFTAR MENU            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  // Satu daftar tunggal (layout Rin 2026-10-20): phase 01-12, lalu aksi
  // 13-15, lalu mode jalan pintas. Dulu 00/13/14/15 tercetak terpisah di
  // bawah dan 14/15 muncul dua kali — sisa tambalan ronde demi ronde.
  for (const p of PHASES.filter(x => x.n <= 12)) console.log(`${String(p.n).padStart(2, '0')}. ${p.title}`);
  console.log('13. generate HTML report (+ wallet DB report)');
  for (const p of PHASES.filter(x => x.n >= 14)) console.log(`${p.n}. ${p.title}`);
  console.log('\n A. Jalankan seluruh phase (1-12)');
  console.log(' B. Jalankan Phase 14 & 15, lalu penilaian ulang 09-13 (otomatis bila scan utama sudah ada)');
  console.log(' C. Scan Ulang (phase penting saja, untuk CA yang sudah pernah di-scan)');
  console.log('\n V. Set API key Helius');
  console.log(' X. Keluar\n');
}
function phaseArgs(n, mint, allMode) {
  if (n === 10) return ['--mint', mint];
  if (n === 11) return allMode ? ['--mint', mint, '--no-menu'] : ['--mint', mint];
  return [mint];
}
let activeChild = null;
let interruptRequested = false;
process.on('SIGINT', () => {
  if (activeChild) {
    interruptRequested = true;
    console.log('\n⚠ Ctrl+C diterima. Menghentikan phase yang sedang berjalan...');
    activeChild.kill('SIGINT');
    const killer = setTimeout(() => { if (activeChild && !activeChild.killed) activeChild.kill('SIGTERM'); }, 5000);
    killer.unref();
  } else {
    console.log('\nGunakan X untuk keluar dari menu.');
  }
});
function warnMissingSidecars(mint) {
  // P3 butir 3: tegakkan urutan — sidecar 14/15 harus ada sebelum Phase 9,
  // kalau tidak rule yang bergantung padanya gugur INSUFFICIENT_DATA
  // (kasus "hi" di batch 1: 11 rule rusak karena urutan menu terlewat).
  // Hanya peringatan — tidak memblokir; keputusan tetap di tangan user.
  const dir = path.join(OUTPUT_DIR, mint);
  const missing = [];
  if (!fs.existsSync(path.join(dir, 'funding-graph.json'))) missing.push('funding-graph.json (menu 14)');
  if (!fs.existsSync(path.join(dir, 'market-volume.json'))) missing.push('market-volume.json (menu 15)');
  if (!missing.length) return;
  console.log('\n⚠ PERINGATAN URUTAN (P3): sidecar belum ada sebelum Phase 9:');
  for (const m of missing) console.log(`   - ${m}`);
  console.log('   Rule yang bergantung pada sidecar ini akan menjadi INSUFFICIENT_DATA');
  console.log('   (funding graph -> CTR-02/03/05; market volume -> TCR-01/02/03/04).');
  console.log('   Jalankan menu B (14+15) terlebih dahulu bila ingin rule tersebut terevaluasi.');
}
function runPhase(p, mint, allMode = false, runId = null) {
  if (p.n === 9) warnMissingSidecars(mint);
  return new Promise(resolve => {
    const file = path.join(SCRIPT_DIR, p.file);
    if (!fs.existsSync(file)) { console.error(`\n[${String(p.n).padStart(2,'0')}] FILE NOT FOUND: ${file}`); resolve(false); return; }
    console.log(`\n\n══════════════════ PHASE ${p.n} / ${PHASES.length} ══════════════════`);
    console.log(`${p.title.toUpperCase()}\nTOKEN: ${short(mint)}\n`);
    interruptRequested = false;
    // Selama child phase berjalan, lepaskan input terminal dari readline menu utama.
    // Ini mencegah parent dan child berebut membaca tombol (mis. prompt set_key).
    rl.pause();
    const child = spawn(process.execPath, [file, ...phaseArgs(p.n, mint, allMode)], {
      cwd: ROOT, stdio: 'inherit', env: { ...process.env, SCAN_MINT: mint, SCAN_RUN_ID: runId || process.env.SCAN_RUN_ID || crypto.randomUUID() },
    });
    activeChild = child;
    child.once('error', err => { console.error(`Gagal menjalankan Phase ${p.n}: ${err.message}`); activeChild = null; rl.resume(); resolve(false); });
    child.once('close', (code, signal) => {
      activeChild = null;
      // Ambil kembali input terminal setelah phase selesai atau dihentikan.
      rl.resume();
      if (interruptRequested || signal === 'SIGINT' || signal === 'SIGTERM') {
        console.log(`\nPhase ${p.n} dihentikan oleh pengguna.`); resolve(false); return;
      }
      if (code !== 0) { console.error(`\n⚠ Phase ${p.n} selesai dengan kode ${code ?? 'tidak diketahui'}.`); resolve(false); return; }
      console.log(`\n✓ Phase ${p.n} selesai.`); resolve(true);
    });
  });
}
async function getMint() {
  const mint = await ask('Masukkan CA / Token Mint: ');
  if (!mint) { console.log('CA tidak boleh kosong.'); return null; }
  if (!validMint(mint)) { console.log('Format CA Solana tidak valid.'); return null; }
  return mint;
}
function archiveStep(scanDir, opts = {}) {
  // P2: arsipkan hasil run sebelumnya sebelum ditimpa. Bila arsip GAGAL,
  // run dibatalkan — jangan menimpa satu-satunya bukti scan lama.
  // opts.copy=true (menu C, Ronde 24): arsip berupa salinan; file asli
  // tetap di tempat karena masih dibaca sebagai input selama scan ulang.
  try {
    const arc = archivePreviousRun(scanDir, opts);
    if (arc.archived) console.log(`Hasil scan sebelumnya diarsipkan ke history/${arc.folder}/ (${arc.files} file)${opts.copy ? ' — salinan, file asli tetap di tempat.' : ''}`);
    return true;
  } catch (e) {
    console.error(`⚠ Gagal mengarsipkan hasil sebelumnya: ${e.message}`);
    console.error('Run dibatalkan agar hasil lama tidak tertimpa tanpa arsip. Perbaiki masalah di atas lalu ulangi.');
    return false;
  }
}
async function runAll(mint) {
  const runId = crypto.randomUUID();
  const scanDir = path.join(OUTPUT_DIR, mint);
  fs.mkdirSync(scanDir, { recursive: true });
  if (!archiveStep(scanDir)) return;
  fs.writeFileSync(path.join(scanDir, 'scan-context.json'), JSON.stringify({ run_id: runId, mint, started_at: new Date().toISOString(), mode: 'full_pipeline' }, null, 2) + '\n', 'utf8');
  // Pipeline penuh = phase 1-12. Phase 14 (funding graph), 15 (market volume),
  const PIPELINE = PHASES.filter(p => ![14, 15].includes(p.n));
  console.log(`\nMemulai pipeline 1–12 untuk: ${short(mint)}\nRUN ID: ${runId}\n(Phase 14/15 opsional — jalankan manual bila perlu.)\n`);
  const failed = [];
  let phase11Ok = false;
  for (const p of PIPELINE) {
    const ok = await runPhase(p, mint, true, runId);
    if (p.n === 11) phase11Ok = ok;
    if (!ok) {
      failed.push(p.n);
      const choice = await ask(`Phase ${p.n} gagal. [C] lanjutkan phase berikutnya / [S] hentikan? `);
      if (choice.toLowerCase() !== 'c') break;
    }
  }
  console.log('\n══════════════ RINGKASAN PIPELINE ══════════════');
  console.log(failed.length ? `Phase gagal: ${failed.join(', ')}` : 'Seluruh phase selesai tanpa kode error.');
  console.log(`Output: ${path.join('Output', mint)}`);
  if (phase11Ok) {
    try {
      const report = generateReportHTML(mint, scanDir);
      console.log(`HTML report: ${report.out}`);
    } catch (e) {
      console.error(`⚠ HTML report gagal dibuat: ${e.message}`);
    }
    try {
      const dbReport = generateWalletDbReport(mint);
      console.log(`Wallet DB report: ${dbReport.out}`);
    } catch (e) {
      console.error(`⚠ Wallet DB report gagal dibuat: ${e.message}`);
    }
  } else {
    console.log('HTML report tidak dibuat karena Phase 11 belum berhasil pada run ini.');
  }
}
function ensureContext(mint, mode) {
  const scanDir = path.join(OUTPUT_DIR, mint);
  fs.mkdirSync(scanDir, { recursive: true });
  const contextFile = path.join(scanDir, 'scan-context.json');
  let ctx = null;
  try { ctx = JSON.parse(fs.readFileSync(contextFile, 'utf8')); } catch {}
  if (!ctx || !ctx.run_id) {
    ctx = { run_id: crypto.randomUUID(), mint, started_at: new Date().toISOString(), mode };
    fs.writeFileSync(contextFile, JSON.stringify(ctx, null, 2) + '\n', 'utf8');
  }
  return { scanDir, ctx };
}
// Menu B (Ronde 23, keputusan Rin 2026-10-21): kolektor 14+15 lalu
// OTOMATIS lanjut penilaian ulang 09 → 10 → 11 → 12 → 13, supaya data
// sidecar langsung terbaca penilaian tanpa langkah manual yang rawan
// terlewat (kasus "hi" batch 1). Lanjutan hanya jalan bila hasil
// Phase 1-8 token ini sudah ada; bila belum, B berhenti di kolektor
// dengan pesan jelas. B adalah kelanjutan run yang sama (run_id dari
// scan-context dipakai ulang) — BUKAN scan baru, jadi TIDAK ada
// pengarsipan P2 di sini: mengarsipkan akan memindahkan hasil
// Phase 1-8 keluar folder dan justru merusak rantai penilaiannya.
const COLLECTOR_DOWNSTREAM = [9, 10, 11, 12];
async function runCollectors(mint) {
  const { ctx, scanDir } = ensureContext(mint, 'collectors');
  console.log(`\nMenjalankan kolektor opsional (14 + 15) untuk: ${short(mint)}\n`);
  const failed = [];
  for (const n of [14, 15]) {
    const p = PHASES.find(x => x.n === n);
    const ok = await runPhase(p, mint, true, ctx.run_id);
    if (!ok) failed.push(n);
  }
  console.log('\n══════════════ RINGKASAN KOLEKTOR ══════════════');
  console.log(failed.length ? `Kolektor gagal: ${failed.join(', ')}` : 'Kedua kolektor selesai tanpa kode error.');
  const missingUpstream = [];
  for (let n = 1; n <= 8; n++) {
    if (!fs.existsSync(path.join(scanDir, `phase${n}-result.json`))) missingUpstream.push(n);
  }
  if (missingUpstream.length) {
    console.log('\nPenilaian ulang (09-13) TIDAK dijalankan: hasil Phase 1-8 belum lengkap');
    console.log(`(yang belum ada: ${missingUpstream.map(n => `phase${n}`).join(', ')}).`);
    console.log('Jalankan menu A terlebih dahulu untuk scan utama, lalu ulangi menu B.');
    return;
  }
  if (failed.length) {
    console.log('\nCatatan: ada kolektor yang gagal — sidecar-nya mungkin belum ada atau masih versi lama.');
    console.log('Penilaian ulang tetap dijalankan; Phase 9 akan memperingatkan sidecar yang hilang.');
  }
  console.log('\nMelanjutkan otomatis: 09 → 10 → 11 → 12 → 13 (report)...');
  const downstreamFailed = [];
  let phase11Ok = false;
  for (const n of COLLECTOR_DOWNSTREAM) {
    const p = PHASES.find(x => x.n === n);
    const ok = await runPhase(p, mint, true, ctx.run_id);
    if (n === 11) phase11Ok = ok;
    if (!ok) {
      downstreamFailed.push(n);
      const choice = await ask(`Phase ${n} gagal. [C] lanjutkan phase berikutnya / [S] hentikan? `);
      if (choice.toLowerCase() !== 'c') break;
    }
  }
  console.log('\n══════════════ RINGKASAN MENU B ══════════════');
  console.log(downstreamFailed.length ? `Phase penilaian gagal: ${downstreamFailed.join(', ')}` : 'Penilaian ulang 09-12 selesai tanpa kode error.');
  console.log(`Output: ${path.join('Output', mint)}`);
  if (phase11Ok) {
    try {
      const report = generateReportHTML(mint, scanDir);
      console.log(`HTML report: ${report.out}`);
    } catch (e) { console.error(`⚠ HTML report gagal dibuat: ${e.message}`); }
    try {
      const dbReport = generateWalletDbReport(mint);
      console.log(`Wallet DB report: ${dbReport.out}`);
    } catch (e) { console.error(`⚠ Wallet DB report gagal dibuat: ${e.message}`); }
  } else {
    console.log('HTML report tidak dibuat karena Phase 11 belum berhasil pada run ini.');
  }
}
// Scan Ulang (menu C, layout Rin 2026-10-20): hanya phase yang berubah
// seiring waktu. Phase 01-02 (identitas & authority) dipakai ulang dari
// scan sebelumnya. run_id lama dipertahankan — pola yang sama dengan
// menjalankan phase manual — agar validasi integritas Phase 11 koheren.
const RESCAN_PHASES = [14, 15, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
async function runRescan(mint) {
  const scanDir = path.join(OUTPUT_DIR, mint);
  const contextFile = path.join(scanDir, 'scan-context.json');
  if (!fs.existsSync(contextFile)) {
    console.log('\nCA ini belum pernah di-scan (scan-context.json tidak ada). Gunakan menu A untuk scan pertama.');
    return;
  }
  let ctx = null;
  try { ctx = JSON.parse(fs.readFileSync(contextFile, 'utf8')); } catch {}
  if (!ctx || !ctx.run_id) { console.log('\nscan-context.json rusak/tidak lengkap. Gunakan menu A untuk scan ulang penuh.'); return; }
  // Ronde 24: arsip SALINAN, bukan pindah — bug 27 Okt 2026: arsip pindah
  // memindahkan phase8-result.json (input Phase 14) dan phase1/2-result.json
  // (input Phase 03) sebelum dibaca, sehingga scan ulang gagal berantai.
  if (!archiveStep(scanDir, { copy: true })) return;
  ctx = { ...ctx, mode: 'rescan', rescanned_at: new Date().toISOString() };
  fs.writeFileSync(contextFile, JSON.stringify(ctx, null, 2) + '\n', 'utf8');
  console.log(`\nSCAN ULANG untuk: ${short(mint)}`);
  console.log('Phase 01-02 TIDAK dijalankan ulang (identitas & authority token dipakai dari scan sebelumnya).');
  console.log('Hasil scan sebelumnya sudah diarsipkan ke folder history/ (P2, salinan) — file asli tetap di tempat untuk dibaca phase 14/15 & 03-08.');
  console.log('Urutan: 14 → 15 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12\n');
  const failed = [];
  let phase11Ok = false;
  for (const n of RESCAN_PHASES) {
    const p = PHASES.find(x => x.n === n);
    const ok = await runPhase(p, mint, true, ctx.run_id);
    if (n === 11) phase11Ok = ok;
    if (!ok) {
      failed.push(n);
      const choice = await ask(`Phase ${n} gagal. [C] lanjutkan phase berikutnya / [S] hentikan? `);
      if (choice.toLowerCase() !== 'c') break;
    }
  }
  console.log('\n══════════════ RINGKASAN SCAN ULANG ══════════════');
  console.log(failed.length ? `Phase gagal: ${failed.join(', ')}` : 'Scan ulang selesai tanpa kode error.');
  console.log(`Output: ${path.join('Output', mint)}`);
  if (phase11Ok) {
    try {
      const report = generateReportHTML(mint, scanDir);
      console.log(`HTML report: ${report.out}`);
    } catch (e) { console.error(`⚠ HTML report gagal dibuat: ${e.message}`); }
    try {
      const dbReport = generateWalletDbReport(mint);
      console.log(`Wallet DB report: ${dbReport.out}`);
    } catch (e) { console.error(`⚠ Wallet DB report gagal dibuat: ${e.message}`); }
  } else {
    console.log('Report tidak dibuat karena Phase 11 belum berhasil pada run ini.');
  }
}
function runSetKey() {
  return new Promise(resolve => {
    const file = path.join(SCRIPT_DIR, 'set_key.js');
    if (!fs.existsSync(file)) { console.error('Script/set_key.js tidak ditemukan.'); resolve(false); return; }
    rl.pause();
    const child = spawn(process.execPath, [file], { cwd: ROOT, stdio: 'inherit' });
    child.once('error', err => { console.error(`Gagal menjalankan set_key: ${err.message}`); rl.resume(); resolve(false); });
    child.once('close', code => { rl.resume(); resolve(code === 0); });
  });
}
async function main() {
  if (!fs.existsSync(path.join(ROOT, 'Config', 'config.json'))) {
    console.error('Config/config.json tidak ditemukan.'); process.exitCode = 1; return;
  }
  if (!fs.existsSync(path.join(ROOT, 'Data', 'database-wallet.json'))) {
    console.error('Data/database-wallet.json tidak ditemukan.'); process.exitCode = 1; return;
  }
  while (true) {
    banner();
    const choice = (await ask('Pilih menu: ')).toUpperCase();
    if (choice === 'X') break;
    if (choice === '13') {
      const mint = await getMint();
      if (mint) {
        try {
          const report = generateReportHTML(mint);
          console.log(`\n✓ HTML report dibuat: ${report.out}`);
          console.log(`SHA-256: ${report.sha256}`);
        } catch (e) { console.error(`\n⚠ Gagal membuat HTML report: ${e.message}`); }
        // Ronde 14: report khusus wallet DB (terpisah). Kegagalan di sini
        // tidak boleh menggagalkan report utama.
        try {
          const dbReport = generateWalletDbReport(mint);
          console.log(`✓ Wallet DB report dibuat: ${dbReport.out}`);
        } catch (e) { console.error(`⚠ Gagal membuat wallet DB report: ${e.message}`); }
      }
      await ask('\nTekan Enter untuk kembali ke menu...');
      continue;
    }
    if (choice === 'A' || choice === '00') {
      const mint = await getMint(); if (mint) await runAll(mint);
      await ask('\nTekan Enter untuk kembali ke menu...'); continue;
    }
    if (choice === 'B') {
      const mint = await getMint(); if (mint) await runCollectors(mint);
      await ask('\nTekan Enter untuk kembali ke menu...'); continue;
    }
    if (choice === 'C') {
      const mint = await getMint(); if (mint) await runRescan(mint);
      await ask('\nTekan Enter untuk kembali ke menu...'); continue;
    }
    if (choice === 'V') {
      await runSetKey();
      await ask('\nTekan Enter untuk kembali ke menu...'); continue;
    }
    const p = PHASES.find(x => String(x.n).padStart(2, '0') === choice || String(x.n) === choice);
    if (!p) { console.log('Pilihan tidak dikenal.'); await ask('Tekan Enter untuk kembali...'); continue; }
    const mint = await getMint();
    if (mint) {
      const scanDir = path.join(OUTPUT_DIR, mint);
      fs.mkdirSync(scanDir, { recursive: true });
      const contextFile = path.join(scanDir, 'scan-context.json');
      let runId = null;
      try { runId = JSON.parse(fs.readFileSync(contextFile, 'utf8'))?.run_id || null; } catch {}
      if (!runId) { runId = crypto.randomUUID(); fs.writeFileSync(contextFile, JSON.stringify({ run_id: runId, mint, started_at: new Date().toISOString(), mode: 'manual_phases' }, null, 2) + '\n', 'utf8'); }
      const ok = await runPhase(p, mint, false, runId);
      if (ok && p.n === 11) {
        try {
          const report = generateReportHTML(mint, scanDir);
          console.log(`✓ HTML report dibuat: ${report.out}`);
        } catch (e) { console.error(`⚠ HTML report gagal dibuat: ${e.message}`); }
      }
    }
    await ask('\nTekan Enter untuk kembali ke menu...');
  }
  rl.close(); console.log('\nKeluar dari Solana Token Intelligence.');
}
main().catch(e => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; rl.close(); });
