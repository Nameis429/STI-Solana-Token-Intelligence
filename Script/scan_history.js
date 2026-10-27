'use strict';
/* scan_history.js — P2 (roadmap 2026-10-20): arsip otomatis hasil scan.
 *
 * Sebelum pipeline (menu A / C) menulis ulang Output/<mint>, hasil run
 * sebelumnya dipindahkan ke Output/<mint>/history/<timestamp>/ agar
 * bukti scan lama tidak hilang tertimpa. `liquidity_history.jsonl`
 * SENGAJA tetap di tempatnya — desain LTR-02/03 membacanya sebagai satu
 * deret utuh lintas scan. Folder history/ sendiri tidak ikut diarsipkan.
 */
const fs = require('fs');
const path = require('path');

const KEEP_IN_PLACE = new Set(['liquidity_history.jsonl', 'history']);

function sanitizeTs(iso) {
  const s = String(iso || '').replace(/[:.]/g, '-').replace(/[^0-9A-Za-z\-]/g, '');
  return s || 'unknown-time';
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/* Arsipkan hasil run sebelumnya di mintDir. Mengembalikan
 * {archived:false, reason} bila tidak ada hasil yang layak diarsipkan
 * (scan pertama / folder kosong), atau {archived:true, folder, files}.
 * Nama folder diambil dari stempel run yang diarsipkan
 * (scan-context: rescanned_at || started_at) agar kronologis.
 * Opsi opts.copy=true (Ronde 24, menu C): arsip berupa SALINAN — file
 * asli tetap di tempatnya, karena phase 14/15 dan 03-08 pada scan ulang
 * masih membaca hasil lama sebagai input (phase8-result.json untuk 14,
 * phase1/2-result.json untuk 03). Mode default (pindah) tetap dipakai
 * menu A, yang meregenerasi semua inputnya dari nol. */
function archivePreviousRun(mintDir, opts = {}) {
  const now = opts.now || new Date();
  if (!fs.existsSync(mintDir)) return { archived: false, reason: 'folder belum ada' };
  const entries = fs.readdirSync(mintDir, { withFileTypes: true })
    .filter(e => e.isFile() && !KEEP_IN_PLACE.has(e.name));
  const hasResults = entries.some(e => /^phase\d+-result\.json$/.test(e.name));
  if (!hasResults) return { archived: false, reason: 'belum ada hasil scan sebelumnya' };
  const ctx = readJsonSafe(path.join(mintDir, 'scan-context.json'));
  const stamp = sanitizeTs(ctx?.rescanned_at || ctx?.started_at || now.toISOString());
  const histRoot = path.join(mintDir, 'history');
  fs.mkdirSync(histRoot, { recursive: true });
  let folder = stamp;
  let dest = path.join(histRoot, folder);
  let k = 2;
  while (fs.existsSync(dest)) { folder = `${stamp}-${k++}`; dest = path.join(histRoot, folder); }
  fs.mkdirSync(dest, { recursive: true });
  const moved = [];
  for (const e of entries) {
    if (opts.copy) fs.copyFileSync(path.join(mintDir, e.name), path.join(dest, e.name));
    else fs.renameSync(path.join(mintDir, e.name), path.join(dest, e.name));
    moved.push(e.name);
  }
  fs.writeFileSync(path.join(dest, 'ARCHIVE_INFO.json'), JSON.stringify({
    archived_at: now.toISOString(),
    run_id: ctx?.run_id || null,
    mode: ctx?.mode || null,
    archive_mode: opts.copy ? 'copy' : 'move',
    files: moved,
  }, null, 2) + '\n', 'utf8');
  return { archived: true, folder, files: moved.length };
}

/* Folder arsip terbaru (nama terurut = kronologis), atau null. */
function latestHistoryDir(mintDir) {
  const histRoot = path.join(mintDir, 'history');
  if (!fs.existsSync(histRoot)) return null;
  const dirs = fs.readdirSync(histRoot, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
  return dirs.length ? path.join(histRoot, dirs[dirs.length - 1]) : null;
}

module.exports = { archivePreviousRun, latestHistoryDir, sanitizeTs, readJsonSafe };
