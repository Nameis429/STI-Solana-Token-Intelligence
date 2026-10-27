# Dossier Kalibrasi P5 — Hitung Ulang FINAL C1–C4 (27 Okt 2026)

**Status:** FINAL — hitung ulang atas label formal 7 hari Batch 1 yang LENGKAP (22/22).
**Sumber data:** `P5_calibration_dataset_2026-10-27.json` (beku 27 Okt; nilai raw scan tidak berubah dari dataset 25 Okt).
**Keputusan yang dijalankan:** otorisasi bersyarat Rin 25 Okt 2026 — implementasi HANYA untuk item yang lolos gerbang di bawah.
**Hasil implementasi:** ronde25 (`STI_v2026-10-27_ronde25.zip`) — C1 dan C2 diimplementasi; C3 dan C4 TIDAK diubah; guardrail dimensi-hilang hanya rancangan (belum diimplementasi).

## Langkah 1 — Kelengkapan label (LOLOS, tidak ada yang kurang)

| CA | Label formal 7 hari | rel_sol | Klasifikasi STRICT |
|---|---|---|---|
| SUPERCORE (`3ZAnpeVBHAvZsySNMXp4g9nYaE1jsx6khgh29VYKpump`) | HIDUP (cek 26 Okt 02:00 WIB) | −70,7% | BURUK (rel ≤ −70%) |
| Mimi (`8CYyivwMZPg6Edaofxo3eHiveZkDrU6TtUDwtMjTpump`) | HIDUP LEMAH (cek 27 Okt 02:30 WIB) | −95,7% | BURUK (status) |
| PikaJew (`AsBqkfnMbu6mvjjgSCW24ZpL3dyzz3A8qygtfM3Rpump`) | HIDUP LEMAH (cek 27 Okt 02:30 WIB) | n/a (tanpa baseline harga) | BURUK (status) |
| Baton (`Hg5Ja55T5wESq4vyFoiVCMeHXtGyVA69X2UHq8hgpump`) | HIDUP (cek 27 Okt 02:00 WIB) | n/a | — di luar Batch 1, dilaporkan terpisah, TIDAK masuk dataset kalibrasi |

## Langkah 2 — Pergeseran vs dataset 25 Okt (TIDAK ADA ANOMALI)

- 19 label formal lama: **0 pergeseran** — nilai status, rel_sol, likuiditas, dan mcap identik dengan dataset 25 Okt. Perbaikan FORMAL FREEZE (script outcome tidak lagi menimpa checkpoint '7d') **terbukti bekerja**.
- Satu-satunya perubahan: 3 label baru di atas (sebelumnya null).
- Nilai raw scan (SPR-02, CTR-02, CTR-03, dimensi Phase 11) tidak berubah untuk semua 22 CA.
- `outcome_latest_interim` dibawa apa adanya dari snapshot 25 Okt (tidak dipakai dalam kalibrasi).

## Definisi "buruk" (STRICT, sama seperti dossier 25 Okt)

**Buruk:** status MATI/RUG, HIDUP LEMAH, atau rel_sol ≤ −70% → **13 dari 22** (base rate 59,1%).
Buruk: LouLou, Nihilism, dev/null, KWIF, SUPERCORE, SEALS, hi, Mimi, Glow, DIKSHIT, PikaJew, STARMAN, WAITIE.
Baik: Aloooong, DOPE, EXFIL, Pepper, DUO, TXGYM, CCAT, Normie, Nought.
Definisi BROAD (tambah rel ≤ −50%) **tetap identik dengan STRICT** — tidak ada CA di (−70%, −50%] (Pepper −49,6%; DOPE −44,4%; SUPERCORE −70,7% sudah masuk STRICT).

**Catatan definisi recall:** "terevaluasi" = status TRIGGERED saja (metodologi yang sama dengan dossier 25 Okt dan script analisis). Buruk yang tidak terevaluasi oleh suatu rule tidak masuk penyebut recall gerbang — tetapi tetap dicatat di bawah sebagai yang lolos dari sinyal.

## C1 — SPR-02 (sebelumnya: ≥5 sell/jam/wallet) — LOLOS, DIIMPLEMENTASI

Evaluable = TRIGGERED saja: 20 CA (LouLou INSUFFICIENT_DATA dan KWIF PROVISIONAL tidak terevaluasi). Buruk terevaluasi: 11 dari 13 buruk.

| T | fired | presisi | recall (dari 11 buruk terevaluasi) |
|---|-------|---------|-----------------------------------|
| 5 (lama) | 20 | 0,55 | 1,00 |
| 10 | 19 | 0,58 | 1,00 |
| 20 | 17 | 0,65 | 1,00 |
| **30** | **14** | **0,79 (11/14)** | **1,00 (11/11)** |
| 50 | 13 | 0,77 | 0,91 |
| 75 | 7 | 0,71 | 0,45 |

**Gerbang C1 T=30: presisi 0,786 ≥ 0,60 ✓ DAN recall 1,00 ≥ 0,85 ✓ → LOLOS.**
Fired di T=30: 11 buruk + 3 baik (EXFIL raw 133, Pepper 63, CCAT 95). EXFIL tetap pengecualian yang konsisten (raw tertinggi, outcome terbaik +290,1%). Yang lolos dari sinyal: LouLou dan KWIF (tidak terevaluasi). Dari total 13 buruk, T=30 menangkap 11.

**Implementasi ronde25:** `Config/phase9_rules.json` SPR-02 `min_count` 5 → 30. Jalur alternatif PROVISIONAL (≥3) tidak diubah.

## C2 — CTR-02 (sebelumnya: biner, tanpa threshold numerik) — LOLOS, DIIMPLEMENTASI

Evaluable = TRIGGERED saja: 19 CA (LouLou NOT_TRIGGERED dan hi INSUFFICIENT_DATA tidak terevaluasi). Buruk terevaluasi: 11 dari 13 buruk.

| T (raw count) | fired | presisi | recall (dari 11 buruk terevaluasi) |
|---|---|---|---|
| biner (lama, semua TRIGGERED) | 19 | 0,58 | 1,00 |
| 5 | 18 | 0,61 | 1,00 |
| **10** | **15** | **0,73 (11/15)** | **1,00 (11/11)** |
| 20 | 13 | 0,69 | 0,82 |
| 50 | 6 | 0,83 | 0,45 |

**Gerbang C2 T=10: presisi 0,733 ≥ 0,60 ✓ DAN recall 1,00 ≥ 0,85 ✓ → LOLOS.**
Fired di T=10: 11 buruk + 4 baik (DOPE 26, Pepper 34, DUO 24, Nought 67 — ditambah 3 buruk baru SUPERCORE 23, Mimi 35, PikaJew 14 yang semuanya menyala di T=10). Yang lolos dari sinyal: LouLou (NOT_TRIGGERED, −86,8%) dan hi (INSUFFICIENT_DATA). Dari total 13 buruk, T=10 menangkap 11.

**Implementasi ronde25:** `Config/phase9_rules.json` CTR-02 mendapat `min_count: 10`; `Script/phase9_risk_engine.js` `evaluateCtr02` kini TRIGGERED hanya bila `qualifying_sequences` ≥ 10 (default 1 bila konfigurasi lama tanpa `min_count`); di bawah ambang menjadi NOT_TRIGGERED dengan alasan yang memuat disclaimer. Disclaimer "CTR-02 padam ≠ aman" (pelajaran LouLou) juga masuk `limitations` Phase 11 — dan dengan itu `report.html` — bila CTR-02 NOT_TRIGGERED.

## C3 — CTR-03 — TIDAK DIUBAH (sesuai rekomendasi yang diterima)

Evaluable = TRIGGERED: 21 CA (LouLou INSUFFICIENT_DATA). Buruk terevaluasi: 12.

| T | fired | presisi | recall (dari 12 buruk terevaluasi) |
|---|---|---|---|
| tanpa threshold (kini, semua TRIGGERED) | 21 | 0,57 | 1,00 |
| 30 | 15 | 0,67 | 0,83 |
| 50 | 12 | 0,75 | 0,75 |
| 75 | 10 | 0,80 | 0,67 |
| 100 | 5 | 0,80 | 0,33 |

**Temuan final:** sama seperti dossier 25 Okt — presisi naik di T tinggi hanya karena recall runtuh dan n mengecil, bukan diskriminasi yang meyakinkan. **Tidak ada perubahan kode untuk C3.** Opsi desain "relasi terverifikasi" tetap menjadi PR definisi + data Batch 2 (dataset tidak merekam status verifikasi relasi per temuan, sehingga tidak bisa disimulasikan).

## C4 — Bobot dimensi Phase 11 — TIDAK DIUBAH (sesuai rekomendasi yang diterima)

- `token_control`: 99,34–100 (stdev 0,14) — jenuh total. `fee_utility`: null di semua (NOT_USED, perilaku M2 yang benar). Satu-satunya dimensi bervariasi, `risk_findings` (0–22), tidak memisahkan outcome.

| Varian bobot | rerata buruk | rerata baik | buruk di bawah median |
|---|---|---|---|
| A — kini (20/20/15/10/25) | 62,1 | 61,5 | 6/13 |
| B — risk-heavy (10/10/10/10/60) | 36,8 | 35,6 | 7/13 |
| C — flat (25/25/25/0/25) | 65,0 | 64,7 | 6/13 |

Skor tidak monoton di ujung mana pun: WAITIE 51,25 (terendah) buruk DAN LouLou 81,36 (tertinggi) buruk. **Tidak ada perubahan bobot.** LouLou tetap 80,0–81,36 di semua varian karena dimensi risk-nya hilang lalu direnormalisasi ke atas — inilah yang memotivasi rancangan guardrail di bawah.

## Rancangan guardrail "dimensi hilang → penalti kepercayaan skor" (RANCANGAN SAJA, BELUM DIIMPLEMENTASI)

Masalah: bila satu dimensi tidak tersedia (mis. `risk_findings` LouLou hilang), bobotnya dikeluarkan dari denominator sehingga skor naik secara artifisial — kehilangan bukti justru terlihat seperti tidak ada risiko. Rancangan yang diajukan untuk persetujuan Rin (bukan keputusan, belum ada kode yang diubah):

- **Prinsip:** skor resmi (formula Phase 11) TIDAK diubah; yang dipenalti adalah **confidence/coverage**, bukan skor — agar tidak ada kalibrasi diam-diam.
- **Draf yang diusulkan:** bila ada dimensi yang hilang, (a) confidence score dikalikan faktor `bobot_tersedia / bobot_total` (mis. LouLou: bobot tersedia 55/90 → confidence × 0,61), dan (b) limitations Phase 11 menambahkan baris eksplisit "Dimensi X tidak tersedia — confidence dipenalti, skor tidak dikoreksi" agar pembaca laporan melihatnya.
- **Opsi alternatif:** (B) cap confidence maksimal MEDIUM bila ada dimensi hilang, tanpa penalti proporsional; (C) hanya penanda limitations tanpa penalti numerik (status quo yang diperjelas).
- **Yang masih perlu ditetapkan Rin sebelum implementasi:** opsi mana yang dipakai, apakah penalti berlaku untuk semua dimensi atau hanya `risk_findings`, dan apakah penalti juga memengaruhi `coverage` atau hanya `confidence`. Sampai itu diputuskan, guardrail ini TIDAK masuk ronde25.

## Ringkasan per-item untuk keputusan (final)

| Item | Hasil hitung ulang final | Tindakan ronde25 |
|---|---|---|
| C1 SPR-02 T=30 | LOLOS (presisi 0,786; recall 1,00) | DIIMPLEMENTASI (min_count 5 → 30) |
| C2 CTR-02 T=10 + disclaimer | LOLOS (presisi 0,733; recall 1,00) | DIIMPLEMENTASI (min_count 10 + disclaimer LouLou) |
| C3 CTR-03 | Tidak ada diskriminasi meyakinkan | TIDAK DIUBAH |
| C4 bobot Phase 11 | Tidak ada pemisahan outcome | TIDAK DIUBAH |
| Guardrail dimensi-hilang | Bukti LouLou kuat, desain belum ditetapkan | RANCANGAN SAJA, menunggu keputusan Rin |

**Verifikasi implementasi:** 5 test baru `tests/ronde25_p5_calibration.test.js` + penyesuaian 1 test lama CTR-02 (fixture 1 sequence kini NOT_TRIGGERED, diubah ke 10 funder). `npm test`: **248/248 PASS** termasuk ekstraksi bersih dari ZIP. ZIP aktif: `STI_v2026-10-27_ronde25.zip` (ronde24 dihapus sesuai konvensi). Tidak ada yang dipublikasikan atau di-push ke GitHub; deliverable hanya lewat chat.

**Langkah berikut:** Batch 2 (20 CA, discan pra-kalibrasi dengan ronde21) tetap berperan sebagai penguji independen hasil kalibrasi ini; label outcome 7 hari Batch 2 jatuh tempo 29 Okt, 30 Okt, dan 1 Nov 2026.
