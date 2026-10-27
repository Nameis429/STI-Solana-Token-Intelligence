# Dossier Kalibrasi P5 — C1–C4 (analisis offline, 23 Okt 2026)

**Status:** PERSIAPAN — menunggu kata "jalan" dari Rin. Tidak ada kode STI yang diubah.
**Sumber data:** `P5_calibration_dataset_2026-10-23.json` (beku; 22 CA Batch 1, raw values + label).
**Label:** 13 formal 7-hari (kohort 15–16 Okt) + 9 interim (kohort 17/19/20 Okt, jatuh tempo 24/26/27 Okt).

## Metodologi & batasan (baca dulu)

- Definisi "buruk" dipakai dua versi, keduanya dilaporkan:
  - **STRICT:** MATI/RUG, HIDUP LEMAH, atau rel_sol ≤ −70% → 6 dari 13 formal.
  - **BROAD:** STRICT + rel_sol ≤ −50% → 8 dari 13 formal (tambah DOPE −54,3%, Pepper −54,1%).
- Simulasi threshold murni hitung-ulang dari nilai raw tersimpan; outcome tidak disentuh.
- **Batasan utama:** n=13 formal itu kecil; jendela outcome baru 7 hari; 4 CA formal berlabel HIDUP tanpa angka rel (KWIF, CCAT, Normie; STARMAN MATI tanpa rel).
- 9 label formal susulan (24/26/27 Okt) + Batch 2 (penguji independen) belum masuk — analisis ini WAJIB diulang saat data masuk sebelum implementasi ronde baru.

## C1 — Threshold SPR-02 (saat ini: ≥5 sell/jam/wallet)

**Evidence (13 formal; 11 TRIGGERED evaluable — LouLou INSUFFICIENT, KWIF PROVISIONAL dikecualikan):**

| T | fired | precision STRICT | recall STRICT | precision BROAD | recall BROAD |
|---|-------|-----------------|---------------|-----------------|--------------|
| 5 | 11 | 0,36 | 1,00 | 0,55 | 1,00 |
| 10 | 10 | 0,40 | 1,00 | 0,50 | 0,83 |
| 20 | 9 | 0,44 | 1,00 | 0,56 | 0,83 |
| 30 | 8 | 0,50 | 1,00 | 0,63 | 0,83 |
| 50 | 7 | 0,43 | 0,75 | 0,57 | 0,67 |
| 75+ | ≤3 | ≤0,50 | ≤0,25 | ≤0,50 | ≤0,17 |

**Temuan penentu:** EXFIL — raw TERTINGGI (133), outcome TERBAIK (+160,4%) — menyala di SEMUA threshold. Sebaliknya STARMAN (MATI/RUG) raw-nya cuma 47. Volume sell/jam/wallet, sendirian, tidak memprediksi outcome 7-hari.

**Opsi:**
- (a) Naikkan threshold ke 20–30: memangkas noise, recall BROAD tetap 0,83. Tidak memperbaiki diskriminasi secara fundamental.
- (b) Pertahankan 5, tapi turunkan bobot hukuman SPR-02 (kalibrasi bobot, bukan angka).
- (c) Pertahankan 5 apa adanya.

**Opini π (alasan dulu, putusan di tanganmu):** data tidak mendukung threshold mana pun sebagai prediktor — masalahnya bukan angkanya, tapi sinyalnya. Kalau tujuannya mengurangi false positive, (a) paling defensibel; kalau tujuannya kejujuran prediktif, (b) lebih jujur. Rekomendasi: (a) sebagai pembukaan kunci terbatas, ATAU tunda sampai 9 label susulan masuk.

## C2 — CTR-02 (saat ini: biner, tanpa threshold numerik)

**Evidence (13 formal):** hanya 2 contoh negatif — LouLou (NOT_TRIGGERED, −83,4%) dan Normie (NOT_TRIGGERED, HIDUP).

| T (raw count) | fired | precision STRICT | recall STRICT | precision BROAD | recall BROAD |
|---|-------|-----------------|---------------|-----------------|--------------|
| 1 (biner kini) | 10 | 0,50 | 0,83 | 0,70 | 0,88 |
| 10 | 7 | 0,71 | 0,83 | **1,00** | 0,88 |
| 20 | 6 | 0,67 | 0,67 | 1,00 | 0,75 |
| 50 | 3 | 1,00 | 0,50 | 1,00 | 0,38 |

**Temuan penentu:** pada T=10 (BROAD), 7/7 yang menyala buruk, 5/6 yang tidak menyala baik — TAPI satu-satunya kasus buruk yang lolos adalah **LouLou**: CTR-02 padam, skor tertinggi batch (81), crash −83,4%. Konfirmasi temuan audit: **CTR-02 padam BUKAN jaminan aman.**

**Opsi:**
- (a) Tambah threshold numerik T=10 pada raw count CTR-02 — satu-satunya item dengan dukungan data terkuat di dossier ini.
- (b) Pertahankan biner.

**Opini π:** (a) layak dibuka sebagai kunci terbatas — dengan syarat disclaimer "padam ≠ aman" tetap tercetak di report (pelajaran LouLou tidak boleh hilang). Ulangi hitung saat 9 label susulan masuk; bila T=10 goyah, kunci ditutup lagi.

## C3 — CTR-03 (saat ini: menyala 21/22, tanpa threshold)

**Evidence (13 formal; 12 evaluable — LouLou INSUFFICIENT):** TIDAK ADA threshold yang membantu.

| T | fired | precision STRICT | precision BROAD | recall BROAD |
|---|-------|-----------------|-----------------|--------------|
| 5–30 | 10 | 0,40 | 0,60 | 0,86 |
| 50 | 7 | 0,43 | 0,57 | 0,57 |
| 75 | 6 | 0,50 | 0,67 | 0,57 |
| 100 | 2 | 0,50 | 0,50 | 0,14 |

Precision di semua T ≈ base rate (0,39 STRICT / 0,54 BROAD). Menggeser angka = memindahkan tiang gawang di lapangan yang salah.

**Opsi:**
- (a) Opsi desain: syarat "relasi terverifikasi" vs "count minimum" — **tidak bisa disimulasikan**: dataset tidak merekam status verifikasi relasi per temuan.
- (b) Threshold 75 sebagai peredam noise (bukti lemah).
- (c) Pertahankan; tandai CTR-03 sebagai sinyal konteks, bukan hukuman.

**Opini π:** (c) + catat (a) sebagai pekerjaan rumah: definisikan dulu operasional "relasi terverifikasi", kumpulkan datanya di Batch 2, baru kalibrasi. Mengunci angka sekarang = kalibrasi palsu.

## C4 — Bobot dimensi Phase 11

**Evidence (22 CA):**
- `token_control`: 100 di 21/22 CA (stdev 0,14) — **jenuh total**, menyumbang ~25 poin konstan ke semua skor.
- `creator_activity`: 65 (default) di 21/22 CA — nyaris konstan.
- `fee_utility`: null di 22/22 (tanpa bukti terverifikasi → NOT_USED; perilaku M2 ronde 19 yang benar).
- Satu-satunya dimensi bervariasi: `risk_findings` (0–22) — TAPI tidak membedakan outcome: EXFIL (+160,4%) = 14,38 vs STARMAN (MATI/RUG) = 14,21 — pemenang dan rug nyaris identik.

**Rekomposisi skor (13 formal, STRICT; B=buruk):**

| Varian bobot | rerata B | rerata ok | B di bawah median |
|---|---|---|---|
| A — kini (20/20/15/10/25) | 64,9 | 61,8 | 3/6 |
| B — risk-heavy (10/10/10/10/60) | 41,5 | 37,5 | 4/6 |
| C — flat (25/25/25/0/25) | 67,6 | 64,9 | 2/6 |

Skor kini **terbalik**: CA buruk rerata LEBIH TINGGI dari yang baik. Tidak ada varian bobot yang memperbaikinya secara berarti.

**Temuan samping (bukan kalibrasi, tapi guardrail):** LouLou (risk_findings INSUFFICIENT) dapat skor 81 — tertinggi batch — karena dimensi yang hilang "diisi" konstanta dimensi jenuh. Aturan yang hilang harusnya menurunkan kepercayaan skor, bukan menggelembungkannya.

**Opsi:**
- (a) Jangan ubah bobot — data tidak mendukung (rekomendasi backtest 13 Okt: TUNDA, masih berlaku).
- (b) Pindahkan bobot token_control → risk_findings (varian B: perbaikan marjinal, skala skor runtuh ke 31–43).

**Opini π:** (a). n=13 belum cukup untuk kalibrasi bobot produksi. Yang layak dibawa ke ronde berikutnya sebagai *perbaikan*, bukan kalibrasi: guardrail "dimensi hilang → penalti kepercayaan skor".

## Ringkasan per-item untuk keputusanmu

| Item | Rekomendasi π | Sifat |
|---|---|---|
| C1 SPR-02 | (a) threshold 20–30, ATAU tunda menunggu 9 label | Kunci terbatas |
| C2 CTR-02 | (a) threshold T=10 + disclaimer "padam ≠ aman" | Kunci terbatas |
| C3 CTR-03 | (c) pertahankan; (a) jadi PR definisi+data Batch 2 | Tunda |
| C4 bobot | (a) jangan ubah; guardrail missing-dimensi sebagai perbaikan terpisah | Tunda |

**Langkah berikut (bila kamu bilang jalan):** kunci keputusan per item di atas → ulangi simulasi saat 9 label susulan masuk (24/26/27 Okt) → implementasi ronde baru HANYA untuk item yang lolos ulang → Batch 2 tetap penguji independen (tidak dipakai training).
