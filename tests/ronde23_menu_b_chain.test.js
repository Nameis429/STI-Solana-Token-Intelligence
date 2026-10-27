'use strict';
/* Ronde 23 (keputusan Rin 2026-10-21): menu B tidak lagi berhenti di
 * kolektor 14+15 — setelah kolektor selesai, B lanjut OTOMATIS ke
 * penilaian ulang 09 → 10 → 11 → 12 → 13 (report) bila hasil
 * Phase 1-8 token sudah ada; bila belum lengkap, B berhenti di
 * kolektor dengan pesan jelas. main.js interaktif, jadi perilakunya
 * diuji dari bentuk sumbernya (pola yang sama dengan uji peringatan
 * sidecar di ronde21) + uji PTY manual tercatat di laporan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const segStart = src.indexOf('async function runCollectors');
const segEnd = src.indexOf('// Scan Ulang', segStart);
const seg = src.slice(segStart, segEnd);

test('menu B: rantai lanjutan persis 09,10,11,12 dan report sesudahnya', () => {
  assert.ok(segStart >= 0 && segEnd > segStart, 'runCollectors ditemukan');
  assert.match(src, /COLLECTOR_DOWNSTREAM = \[9, 10, 11, 12\]/);
  assert.match(seg, /for \(const n of COLLECTOR_DOWNSTREAM\)/);
  assert.match(seg, /generateReportHTML\(mint, scanDir\)/);
  assert.match(seg, /generateWalletDbReport\(mint\)/);
});

test('menu B: penjaga kelengkapan Phase 1-8 sebelum lanjutan', () => {
  assert.match(seg, /for \(let n = 1; n <= 8; n\+\+\)/);
  assert.match(seg, /phase\$\{n\}-result\.json/);
  assert.match(seg, /Penilaian ulang \(09-13\) TIDAK dijalankan/);
});

test('menu B: tanpa pengarsipan P2 (kelanjutan run yang sama, bukan scan baru)', () => {
  assert.doesNotMatch(seg, /archiveStep/);
  assert.doesNotMatch(seg, /archivePreviousRun/);
});

test('menu B: teks menyesatkan lama sudah dicabut, banner mencerminkan perilaku baru', () => {
  assert.doesNotMatch(src, /Lanjutan: jalankan phase 09 \(risk engine\) lalu 11/);
  assert.match(src, /B\. Jalankan Phase 14 & 15, lalu penilaian ulang 09-13/);
});
