# Dossier Kalibrasi P5 — Analisis Pendahuluan C1–C4 (25 Okt 2026)

**Status:** PENDAHULUAN — belum keputusan, belum implementasi, tidak ada kode STI yang diubah.
**Sumber data:** `P5_calibration_dataset_2026-10-25.json` (beku dari file outcome per 25 Okt; nilai raw scan tak berubah dari dataset 24 Okt).
**Label:** 19 formal 7-hari Batch 1. Sisa 3 (SUPERCORE 26 Okt; Mimi, PikaJew 27 Okt) + Baton 27 Okt — hitung ulang final WAJIB sebelum implementasi ronde baru.

## Definisi "buruk" & catatan integritas (baca dulu)

- **Buruk (STRICT):** status MATI/RUG, HIDUP LEMAH, atau rel_sol ≤ −70% → **10 dari 19** (base rate 52,6%).
  Buruk: LouLou, Nihilism, dev/null, KWIF, SEALS, hi, Glow, DIKSHIT, STARMAN, WAITIE.
  Baik: Aloooong, DOPE, EXFIL, Pepper, DUO, TXGYM, CCAT, Normie, Nought.
- Dengan snapshot saat ini, definisi BROAD (tambah rel ≤ −50%) **identik dengan STRICT** — tidak ada CA yang duduk di (−70%, −50%] (Pepper −49,6%; DOPE −44,4% — keduanya baik). Perbedaan itu masih bisa muncul lagi di hitung ulang final.
- **Cacat integritas yang ditemukan saat verifikasi:** script outcome menimpa checkpoint '7d' pada run berikutnya (jendela elapsed 5,9–25 hari), sehingga nilai formal bergeser dari tanggal kohortnya: EXFIL +160,4% → +290,1%; LouLou −83,4% → −86,8%; hi −25,9% → −70,8%. Akibatnya 3 klasifikasi berubah vs dataset 24 Okt (DOPE BROAD buruk→baik; hi buruk→buruk di kedua definisi; Pepper BROAD buruk→baik). Angka di dossier ini memakai snapshot file per 25 Okt dan dibekukan — tetapi **label final harus dibekukan pada tanggal kohortnya**, dan script outcome sebaiknya diperbaiki agar tidak menimpa checkpoint '7d' yang sudah tercatat.

## C1 — Threshold SPR-02 (saat ini: ≥5 sell/jam/wallet)

Evaluable = status TRIGGERED saja (17 CA). 2 CA buruk lolos dari evaluasi apa pun: LouLou (INSUFFICIENT_DATA) dan KWIF (PROVISIONAL).

| T | fired | presisi | recall (dari 8 buruk terevaluasi) |
|---|-------|---------|-----------------------------------|
| 5 (kini) | 17 | 0,47 (= base rate terevaluasi — tanpa diskriminasi) | 1,00 |
| 10 | 16 | 0,50 | 1,00 |
| 20 | 14 | 0,57 | 1,00 |
| **30** | **11** | **0,73** | **1,00** |
| 50 | 10 | 0,70 | 0,88 |
| 75 | 5 | 0,60 | 0,38 |

**Temuan penentu:** EXFIL — raw TERTINGGI (133), outcome TERBAIK (+290,1%) — menyala di semua threshold. Satu-satunya pengecualian yang konsisten. Threshold 30 menangkap semua buruk yang terevaluasi dengan presisi tertinggi, tapi tidak menyentuh 2 buruk yang tidak terevaluasi dan tidak menyingkirkan EXFIL.

**Opsi:** (a) Naikkan ke 30 (kunci terbatas, dukungan data terkuat di dossier ini); (b) pertahankan 5; (c) tunda sampai hitung ulang final.
**Opini π:** (a) layak dibawa ke hitung ulang final — dengan catatan jujur bahwa ini peredam noise, bukan prediktor sempurna (EXFIL + 2 buruk tak terevaluasi tetap lolos).

## C2 — CTR-02 (saat ini: biner, tanpa threshold numerik)

TRIGGERED 16, NOT_TRIGGERED 2, INSUFFICIENT_DATA 1 (hi, buruk).

| T (raw count) | fired | presisi | recall (terevaluasi) |
|---|---|---|---|
| biner kini | 16 | 0,50 | 1,00 (dari 8 buruk terevaluasi) |
| **10** | **12** | **0,67** | **1,00** |
| 20 | 11 | 0,64 | 0,88 |
| 50 | 6 | 0,83 | 0,63 |

**Temuan penentu:** WAITIE raw 103 (tertinggi) → MATI, mendukung threshold. Tetapi LouLou (NOT_TRIGGERED, −86,8%) tetap lolos di semua T — **CTR-02 padam BUKAN jaminan aman**, dan itu harus tetap tercetak sebagai disclaimer bila threshold diterapkan.

**Opsi:** (a) Tambah threshold numerik T=10; (b) pertahankan biner.
**Opini π:** (a) — item dengan dukungan data terkuat kedua setelah C1-T30, dengan syarat disclaimer LouLou.

## C3 — CTR-03 (saat ini: menyala di 18/19, tanpa threshold)

| T | fired | presisi | recall (terevaluasi) |
|---|---|---|---|
| tanpa threshold (kini) | 18 | 0,50 (= base rate terevaluasi) | 1,00 |
| 30 | 12 | 0,58 | 0,78 |
| 50 | 9 | 0,67 | 0,67 |
| 75 | 8 | 0,75 | 0,67 |
| 100 | 3 | 0,67 | 0,22 |

**Temuan:** presisi naik di T tinggi hanya karena recall runtuh dan n mengecil — bukan diskriminasi yang meyakinkan. Sama seperti dossier 23 Okt: menggeser angka tidak memperbaiki sinyalnya.

**Opsi:** (a) Opsi desain "relasi terverifikasi" — tetap tidak bisa disimulasikan (dataset tidak merekam status verifikasi relasi per temuan); jadikan PR definisi + data Batch 2. (b) Threshold 75 sebagai peredam noise (bukti lemah). (c) Pertahankan; tandai sebagai sinyal konteks, bukan hukuman.
**Opini π:** (c). Mengunci angka sekarang = kalibrasi palsu.

## C4 — Bobot dimensi Phase 11

- `token_control`: 99,34–100 (stdev 0,14) — jenuh total, ~20 poin konstan untuk semua.
- `creator_activity`: mayoritas 65 (default). `fee_utility`: null di semua (NOT_USED, perilaku M2 yang benar).
- Satu-satunya dimensi bervariasi, `risk_findings` (0–22), tidak memisahkan outcome.

| Varian bobot | rerata buruk | rerata baik | buruk di bawah median |
|---|---|---|---|
| A — kini (20/20/15/10/25) | 62,4 | 61,5 | 4/10 |
| B — risk-heavy (10/10/10/10/60) | 37,9 | 35,6 | 6/10 |
| C — flat (25/25/25/0/25) | 65,2 | 64,7 | 5/10 |

Skor tidak monoton di ujung mana pun: WAITIE 51,25 (terendah) buruk DAN LouLou 81,36 (tertinggi) buruk. Varian B hanya perbaikan marjinal dengan skala skor runtuh (23–43), dan LouLou tetap 80,0 karena dimensi risk-nya hilang lalu direnormalisasi ke atas.

**Opsi:** (a) Jangan ubah bobot. (b) Pindahkan bobot token_control → risk_findings.
**Opini π:** (a). Yang layak dibawa ke ronde berikutnya sebagai *perbaikan* (bukan kalibrasi): guardrail "dimensi hilang → penalti kepercayaan skor" — LouLou adalah bukti hidupnya.

## Ringkasan per-item untuk keputusanmu (pendahuluan)

| Item | Rekomendasi π (pendahuluan) | Sifat |
|---|---|---|
| C1 SPR-02 | (a) threshold 30 | Kunci terbatas, verifikasi ulang 27 Okt |
| C2 CTR-02 | (a) threshold T=10 + disclaimer "padam ≠ aman" | Kunci terbatas, verifikasi ulang 27 Okt |
| C3 CTR-03 | (c) pertahankan; (a) jadi PR definisi + data Batch 2 | Tunda |
| C4 bobot | (a) jangan ubah; guardrail missing-dimensi sebagai perbaikan terpisah | Tunda |

**Langkah berikut:** hitung ulang final setelah 3 label terakhir (26–27 Okt) → bila rekomendasi di atas bertahan, kamu putuskan per item → implementasi ronde baru HANYA untuk item yang lolos → Batch 2 tetap penguji independen.
