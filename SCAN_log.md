# SCAN Log — Realtime CA (mulai 2026-10-13)

Fase: realtime scan, sampel acak TANPA label bad/good (keputusan Rin 2026-10-13).
Tujuan: kumpulkan data sebanyak mungkin dari CA baru; murni evidence on-chain.
Log ini menjadi dataset kalibrasi untuk C1–C4 (butuh ≥10 CA).

Cara pakai: satu baris per CA setelah run 00→14→15→09→11→13.
Kolom ringkas — detail penuh tetap di Output/<mint>/.

| Tgl | CA (12 char) | Skor | Tier | Conf | TRIG | DB match | Phase12 | Catatan |
|-----|--------------|------|------|------|------|----------|---------|---------|
| 2026-10-14 | 2N8c4pXu6T2o… | 81 | Sangat kuat | 40.28 | 0 | 19 | NEUTRAL_OK | LouLou — ANOMALI: phase 8 hanya 3/52 scanned (49 rate-limited, retry 0 pulih) → 11 rule INSUFFICIENT_DATA, risk_findings & fee_utility unavailable; skor tertinggi justru dari data paling rusak |
| 2026-10-14 | 3sKaoPryg4Kr… | 62 | Kuat | 66.93 | 10 | 45 | NEUTRAL_OK | SEALS — TCR-01/02 TRIGGERED di tier windowed |
| 2026-10-14 | 6x4Z2dr5DgHU… | 62 | Kuat | 56.03 | 5 | 32 | NEUTRAL_OK | hi — satu-satunya CA tanpa market-volume.json & funding-graph.json; 11 rule INSUFFICIENT_DATA |
| 2026-10-14 | 9g4Pib6AM3oV… | 67 | Kuat | 59.26 | 7 | 19 | NEUTRAL_OK | Pepper — parse rate hanya 10.8% (2231/2500 permanent-skip failed_or_missing_tx, BUKAN gagal jaringan); rule market jujur turun ke scope bounded-sample/INSUFFICIENT |
| 2026-10-15 | 2ay4jNY3Jxfu… | 62 | Kuat | 68.53 | 9 | 45 | NEUTRAL_OK | Nihilism |
| 2026-10-15 | 33jENUQnjoit… | 62 | Kuat | 67.8 | 10 | 49 | NEUTRAL_OK | DOPE — DB match tertinggi; TCR-01/02 TRIGGERED di tier windowed; DB adj risk −11.16 (terbesar) |
| 2026-10-15 | AMQ8BusAhpwb… | 62 | Kuat | 67.39 | 9 | 19 | NEUTRAL_OK | DIKSHIT |
| 2026-10-15 | CLrFZt7o6bE3… | 59 | Sedang | 62.27 | 3 | 25 | CAUTION | TXGYM — satu-satunya CAUTION (1 WARN + 1 UNKNOWN kritis di phase 12) |
| 2026-10-15 | DzMwArmdzPqc… | 62 | Kuat | 65.08 | 7 | 16 | NEUTRAL_OK | Normie |
| 2026-10-16 | 3NGdM1KZZMsc… | 58 | Sedang | 67.92 | 5 | 18 | NEUTRAL_OK | KWIF |
| 2026-10-16 | 6FhVPctYg363… | 60 | Sedang | 68.99 | 8 | 12 | NEUTRAL_OK | EXFIL |
| 2026-10-16 | D4rzv9WAXJh9… | 61 | Kuat | 65.85 | 7 | 21 | NEUTRAL_OK | CCAT |
| 2026-10-16 | DiveEYHTf3Lv… | 64 | Kuat | 66.05 | 7 | 32 | NEUTRAL_OK | STARMAN |
| 2026-10-17 | 1htv5Nzfdy44… | 65 | Kuat | 67.5 | 6 | 29 | NEUTRAL_OK | Aloooong |
| 2026-10-17 | 2kuY5DHqRvYK… | 61 | Kuat | 67.66 | 9 | 17 | NEUTRAL_OK | dev/null |
| 2026-10-17 | 9KDhovVA2kdj… | 60 | Sedang | 67.74 | 7 | 32 | NEUTRAL_OK | Glow — DB adj risk −10.68 |
| 2026-10-17 | ADkd6izPxJtK… | 61 | Kuat | 65.78 | 9 | 21 | NEUTRAL_OK | DUO |
| 2026-10-17 | EW9ezwtqvn3v… | 57 | Sedang | 67.92 | 9 | 21 | NEUTRAL_OK | Nought |
| 2026-10-17 | kpw3mRFBxzWF… | 51 | Sedang | 80.7 | 9 | 6 | WATCH | WAITIE — skor terendah tapi confidence tertinggi; DB match terendah |
| 2026-10-19 | 3ZAnpeVBHAvZ… | 64 | Kuat | 66.52 | 7 | 27 | NEUTRAL_OK | SUPERCORE |
| 2026-10-20 | 8CYyivwMZPg6… | 62 | Kuat | 67.32 | 9 | 38 | NEUTRAL_OK | Mimi — satu-satunya DB adj di luar risk (token_control −0.66) |
| 2026-10-20 | AsBqkfnMbu6m… | 57 | Sedang | 69.3 | 8 | 21 | NEUTRAL_OK | PikaJew — rule INSUFFICIENT_DATA paling sedikit (2) |
| 2026-10-20 | Hg5Ja55T5wESq… | 60 | Sedang | 67.97 | 9 | 64 | NEUTRAL_OK | Baton — CA acuan live; uji live pertama Ronde 15/16 LULUS (gerbang P0 benar tidak aktif: INSUFF 4/18 = 22%; headline bertiga tampil; wallet DB report terbuat dari pipeline). DB match tertinggi sejauh ini (64) tapi total bobot DB −4 (MERAH) & retensi DB 19% — kerumunan DB sebagian besar sudah keluar. TCR-01/02 TRIGGERED (922 tx parsed). fee_utility unavailable ke-23 berturut-turut; dimensi risk_findings 0 (risiko agregat maksimum) tapi tertutup token_control 100 + holder 90 |
| 2026-10-21 | Hg5Ja55T5wESq… | 63 | Kuat | 68.67 | 8 | 77 | NEUTRAL_OK | Baton SCAN ULANG #1 (mode C, +13 jam) — terverifikasi π: run_id sama, phase 01/02 dipakai ulang, LTR-02/03 HIDUP (NOT_TRIGGERED; penurunan likuiditas maks 3,22% dari 3 pool terbandingkan); TCR-02 padam di window lebih kaya (parsed 922→1.381); skor 60→63 digerakkan risk_findings 0→9,01; INSUFFICIENT 4→2 (sisa CTR-05 & TCR-04); DB match 64→77 tapi retensi turun 19%→15%, total bobot DB −4→0 (KUNING); phase 8 scanned 100/100, retry pulih 59/59, tapi histori lengkap turun 16→8 |

Batch 1 selesai: **22 CA** (target ≥10 TERCAPAI). Analisis lengkap:
`~/workspace/SCAN_batch1_temuan_2026-10-20.md`. Data mentah:
`~/workspace/scan_batch_2026-10-20/Output/`.

## Aturan main (tetap berlaku)
- Urutan: 00 → 14 → 15 → 09 → 11 → 13. Beri jeda antar CA (trial key).
- Pintu phase 8: wallets_scanned > 0, tanpa rate_limited massal.
- Threshold Phase 9 TERKUNCI — yang berubah hanya perilaku A1/A2/B1/B2/D1.
- ~~DB match ≈ 0 itu wajar untuk CA acak~~ — KOREKSI dari batch 1
  (2026-10-20): DB match aktual 6–49, median 21. Wallet DB Rin ternyata
  sering bersentuhan dengan token pump.fun acak. Bukan sinyal negatif,
  tapi asumsinya salah — lihat laporan batch 1.
- Kalau ada pola berulang yang mencurigakan di ≥3 CA, catat di kolom Catatan
  dan laporkan ke π — itu bahan kalibrasi C1–C4.

---

## Batch 2 — CA BARU untuk pembanding kalibrasi C1–C4 (disetujui Rin 2026-10-21)

- **Target: 20 CA baru** (belum pernah discan) — **15 stabil + 5 kontrol**.
  - Stabil: dipilih dari aktivitasnya — jual-beli dua arah masih berjalan
    berlanjut selama beberapa hari, bukan ramai sekali lalu sepi. BUKAN
    dipilih dari kesan aman/tidak aman.
  - Kontrol: diambil apa adanya, tanpa saringan stabil/tidak.
- **Versi: STI ronde 21**, discan SEBELUM P5 diubah — data murni
  pra-kalibrasi. Peran: penguji independen hasil kalibrasi dari Batch 1.
  P5 tidak ditunda menunggu batch ini.
- Urutan & pintu phase 8: sama seperti aturan main di atas
  (A/00 → 14 → 15 → 09 → 11 → 13; jeda antar CA).
- Untuk tiap CA, catat di kolom Catatan: **kelompoknya (stabil/kontrol)**.
  Tanpa catatan itu pembedaan 15 vs 5 hilang.
- Label outcome 7 hari dihitung dari tanggal scan masing-masing CA;
  π memasang jadwal outcome per kohort tanggal begitu scan masuk.
- **Batch 2 #1 — HOTBOT** (`8nnaeWCw8mUypcGAgbmSuzAT85uWx4UN12adDrMhXrGF`): upaya scan 21 Okt (ronde 21; crash Phase 10 dilaporkan 21:09 WIB, run dinyatakan sah via [C]) digantikan artefak tahap 1 yang diserahkan Rin 25 Okt 2026 — scan-context artefak: **22 Okt 2026** (data di `~/workspace/scan_batch2_2026-10-25/`, ringkasan `extracted.json`). Skor HOTBOT dari artefak: 63 Kuat, eval 88,89%, TRIG 7, INS 2, DB 25. Kelompok: stabil (dilabeli Rin 27 Okt 2026). Label outcome 7-hari kini terjadwal: **29 Okt 09:00 WIB** (cron `outcome-7d-batch2-cohort-2026-10-22`, menggantikan job 28 Okt yang didasarkan pada tanggal 21 Okt). Interim 24 Okt: HIDUP, liq ±$281rb, sudah di Meteora.

| Tgl | CA (12 char) | Skor | Tier | Conf | TRIG | DB match | Phase12 | Catatan |
|-----|--------------|------|------|------|------|----------|---------|---------|
| 2026-10-22 | 98kfF7rmsg1Q… | 57 | Sedang | 77.58 | 5 | 31 | CAUTION | tahap 1; kelompok stabil |
| 2026-10-22 | DvdmEnztCmXw… | 66 | Kuat | 67.04 | 7 | 38 | NEUTRAL_OK | tahap 1; kelompok stabil |
| 2026-10-22 | 5ubruMYpgKqw… | 64 | Kuat | 68.97 | 8 | 26 | NEUTRAL_OK | tahap 1; kelompok kontrol |
| 2026-10-22 | 8nnaeWCw8mUy… | 63 | Kuat | 69.07 | 7 | 25 | NEUTRAL_OK | tahap 1; kelompok stabil |
| 2026-10-22 | DEW9dSN6QpWy… | 66 | Sedang | 61.08 | 4 | 49 | NEUTRAL_OK | tahap 1; kelompok stabil PROVISIONAL |
| 2026-10-23 | 6Mix12LiHrQF… | 67 | Sedang | 63.76 | 4 | 13 | NEUTRAL_OK | tahap 1; kelompok kontrol PROVISIONAL |
| 2026-10-23 | HgTGdc29D5bD… | 64 | Sedang | 72.74 | 4 | 10 | NEUTRAL_OK | tahap 1; kelompok kontrol PROVISIONAL |
| 2026-10-23 | NTRNDMqQSiwE… | 59 | Sedang | 68.06 | 7 | 16 | NEUTRAL_OK | tahap 1; kelompok kontrol |
| 2026-10-23 | 5dvXTZ5qwgaf… | 63 | Sedang | 77.18 | 5 | 16 | NEUTRAL_OK | tahap 1; kelompok stabil PROVISIONAL |
| 2026-10-23 | DKYcjobF7HPt… | 67 | Kuat | 66.67 | 7 | 18 | NEUTRAL_OK | tahap 1; kelompok stabil |
| 2026-10-25 | AKotzk1dhcNa… | 59 | Sedang | 65.63 | 6 | 21 | NEUTRAL_OK | tahap 1; kelompok kontrol |
| 2026-10-25 | 39HqgQ18g9R3… | 64 | Sedang | 62.35 | 3 | 19 | NEUTRAL_OK | tahap 1; kelompok kontrol PROVISIONAL |
| 2026-10-25 | 6mYfg1EmMVjb… | 60 | Sedang | 65.24 | 6 | 6 | NEUTRAL_OK | tahap 1; kelompok kontrol |
| 2026-10-25 | 9CPfv7rc6vxB… | 64 | Sedang | 66.51 | 3 | 9 | AVOID | tahap 1; kelompok stabil PROVISIONAL |
| 2026-10-25 | HsprHxBRgiVa… | 60 | Sedang | 69.44 | 8 | 44 | NEUTRAL_OK | tahap 1; kelompok stabil PROVISIONAL |
| 2026-10-25 | CTPoyCwkjMvo… | 64 | Kuat | 73.19 | 5 | 8 | NEUTRAL_OK | tahap 1; kelompok stabil |
| 2026-10-25 | GWe3TNg1UPxe… | 63 | Kuat | 72.07 | 7 | 9 | AVOID | tahap 1; kelompok kontrol |
| 2026-10-25 | 55A3VxMBfzw6… | 68 | Sedang | 55.23 | 3 | 17 | NEUTRAL_OK | tahap 1; kelompok kontrol PROVISIONAL |
| 2026-10-25 | 5tCju6YNxHq5… | 67 | Sedang | 51.39 | 1 | 9 | NEUTRAL_OK | tahap 1; kelompok stabil PROVISIONAL |
| 2026-10-25 | H8xQ6poBjB9D… | 61 | Kuat | 70.51 | 9 | 17 | NEUTRAL_OK | tahap 1; kelompok stabil |

## Ronde 24 (2026-10-27) — perbaikan bug menu C
- Laporan Rin: scan ulang Baton 27 Okt gagal di Phase 14 (`phase8-result.json tidak ditemukan`); file output "menghilang" ke `history/`.
- Akar: menu C mengarsipkan (pindah) SEBELUM phase berjalan; Phase 14 & 03 kehilangan inputnya. Perbaikan: menu C memakai arsip SALINAN (`opts.copy` di `scan_history.js`); menu A tetap pindah.
- Verifikasi: 3 test baru; `npm test` 243/243 PASS termasuk ekstraksi bersih. ZIP aktif: `STI_v2026-10-27_ronde24.zip` (ronde23 dihapus). ZIP ronde24 TIDAK memuat perubahan kalibrasi P5 — job P5 15:00 WIB digeser ke ronde25 agar tidak tabrakan nama.

## Ronde 25 (2026-10-27) — kalibrasi P5 final: SPR-02 → 30, CTR-02 → ambang 10
- Hitung ulang final atas 22 label formal 7 hari Batch 1 (dataset beku `P5_calibration_dataset_2026-10-27.json`): SUPERCORE HIDUP −70,7%, Mimi HIDUP LEMAH −95,7%, PikaJew HIDUP LEMAH (rel n/a) — ketiganya buruk; total 13 buruk / 9 baik. 19 label lama tidak bergeser (FORMAL FREEZE bekerja). Baton: label 7 hari HIDUP (rel n/a), di luar dataset Batch 1.
- Gerbang lolos keduanya: C1 SPR-02 T=30 presisi 0,786 / recall 1,00; C2 CTR-02 T=10 presisi 0,733 / recall 1,00 (recall di antara buruk yang terevaluasi). C3 & C4 tidak diubah; guardrail dimensi-hilang hanya rancangan di dossier final.
- Perubahan: SPR-02 min_count 5 → 30; CTR-02 min_count 10 + disclaimer "CTR-02 padam ≠ aman" (alasan evaluator + limitations Phase 11/report HTML, pelajaran LouLou).
- Verifikasi: 5 test baru ronde25 + 1 test lama CTR-02 disesuaikan (1 sequence kini NOT_TRIGGERED); `npm test` 248/248 PASS termasuk ekstraksi bersih. ZIP aktif: `STI_v2026-10-27_ronde25.zip` (ronde24 dihapus).

## Scan ulang Baton ke-3 (2026-10-27, mode C, ronde24) — TERVERIFIKASI
- ZIP: `BATON-scan-ulang_0_7fcl.zip` → data `~/workspace/scan_baton_rescan_2026-10-27/` (37 file).
- Mode C LULUS semua uji: run_id sama 24fc517c-aead-465c-8a94-fe487e9d0584; phase1/2 identik byte-dengan-arsip (dipakai ulang, stempel 20 Okt); arsip `history/2026-10-20T16-09-51-107Z/` ber-mode `copy` (bukti perbaikan ronde24 bekerja di lapangan); `scan-comparison.json` + section "Perbandingan Antar-Scan (P2)" di report ada; integritas Phase 11 valid, tanpa error/warning; LTR-02/03 terevaluasi (keduanya NOT_TRIGGERED).
- KOREKSI PEMBANDING: folder VM Rin ternyata berisi scan-1 (bukan scan-2) — arsip history ber-mode `full_pipeline` stempel 20 Okt. Jadi `scan-comparison.json` membandingkan scan-3 vs scan-1 (selisih 7 hari), BUKAN vs scan-2. Scan-2 (21 Okt) ada di mesin lain; perbandingan scan-3 vs scan-2 beku dilakukan manual π dari `backups/baton_scan2_2026-10-21/`.
- Hasil scan-3: skor 63 Kuat (tier 4), confidence 75,88 MEDIUM, terevaluasi 88,89%, INSUFFICIENT 2 (CTR-05, TCR-04 — sama seperti scan-2), gerbang P0 tidak aktif, Phase 12 NEUTRAL_OK. Vs scan-1: 60→63, Sedang→Kuat, conf 67,97→75,88, TRIG 9→5, INS 4→2, risk 0→15,87, fee null→50 USED (M2, buyback/burn). Vs scan-2 beku: skor sama 63, conf 68,67→75,88, risk 9,01→15,87, DB matched 77→11 (bobot total 0→+10, retensi 0,15→0,82), phase8 scanned 100→41, complete 8→6.
- Pra-kalibrasi (ronde24) NORMAL: SPR-02 TRIGGERED (19 sell/jam, threshold lama 5); CTR-02 NOT_TRIGGERED (0 sekuens funding→trade); CTR-03 TRIGGERED (15 asosiasi). Catatan antisipasi: 19 < 30 → di ronde25 SPR-02 akan menjadi NOT_TRIGGERED (efek kalibrasi, bukan perubahan pasar). Fee USED 50 adalah efek M2 ronde19+, bukan anomali.
- Caveat (bukan kegagalan): cakupan phase8 lebih tipis dari scan-2 (selected 56, scanned 41, 15 masih rate-limited setelah 1 pass standar, histori lengkap 6) — sejalan dengan pendinginan token (outcome 7d: HIDUP, liq $568rb→$435rb, mcap $8,18jt→$5,36jt). `liquidity_history.jsonl` di VM ini hanya 2 baris (scan-1 + scan-3); snapshot scan-2 ada di mesin lain.

## Ronde 26 (2026-10-27) — mekanisme rezim dini, skala MENIT (otorisasi Rin 2026-10-27)
- Keputusan Rin: bangun mekanisme dulu, angka menyusul dari kohort; skala umur = menit (bukan jam).
- Isi: batas rezim dini 1440 menit di `settings.early_regime`; slot `early_regime.min_count = null` di SPR-02 & CTR-02 (null = warisi threshold matang 30/10 — perilaku hari ini tidak berubah); umur = scan start (scan-context) minus event Phase 8 tertua (proksi peluncuran, dilabeli jujur); rezim + umur menit tercatat di `scope.token_age` Phase 9 dan metric kedua rule; CTR-02 melaporkan lag dalam menit; Phase 11 menambah baris limitations rezim dini.
- KOREKSI antisipasi ronde25: SPR-02 Baton di bawah ambang 30 ternyata menjadi PROVISIONAL (19 ≥ ambang alternatif 3), bukan NOT_TRIGGERED seperti diantisipasi sebelumnya. Terverifikasi lewat uji ujung-ke-ujung Phase 9 atas salinan data scan-3 Baton (rezim mature, umur teramati 68392,1 menit — event tertua 2026-09-09; CTR-02 tetap NOT_TRIGGERED, 0 sekuens).
- Verifikasi: 11 test baru ronde26; `npm test` 259/259 PASS termasuk ekstraksi bersih dari ZIP (unzip → merge_config → test). ZIP aktif: `STI_v2026-10-27_ronde26.zip` (ronde25 dihapus).

## Ronde 27 (2026-10-27) — audit protokol 24 jam (keputusan Rin 2026-10-27 malam)
- Timeline TERKUNCI sejak RILIS CA: scan-1 1–4 jam, scan-2 10–12 jam, scan-3 (bila perlu) 24 jam setelah rilis. Menggantikan hitungan turunan sebelumnya (scan-3 sebagai selisih sampai 24 jam) dengan jadwal eksplisit ini.
- Perintah: perbaiki rule yang bertabrakan dengan 24 jam. Hasil audit evaluator-per-evaluator: TIDAK ADA yang bertabrakan — ronde 27 tidak mengubah satu pun window/threshold. Window adalah batas lag maksimum, bukan syarat lama observasi: CTR-05 (7 hari) terbukti TRIGGERED dari sekuens berlag 3 jam dalam observasi 24 jam; penghambat CTR-05 selama ini adalah verifikasi relationship + kelengkapan histori, bukan window — memangkasnya tidak memperbaiki apa pun dan hanya membuang deteksi lag panjang token matang. KOREKSI klaim ronde 26 yang menyebut CTR-05 "secara struktural tidak bisa dievaluasi dalam 24 jam": klaim itu salah. LTR-02/03: interval dilaporkan, bukan disyaratkan (2 snapshot 9 jam cukup); TCR-04: paruh dari rentang teramati.
- Verifikasi: 5 test baru ronde27; `npm test` 264/264 PASS termasuk ekstraksi bersih dari ZIP. ZIP aktif: `STI_v2026-10-27_ronde27.zip` (ronde26 dihapus).
