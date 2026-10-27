# Roadmap Pengembangan STI — Pasca Batch 1

**Tanggal:** 2026-10-20 · **Oleh:** π · **Disetujui arahnya oleh:** Rin
**Basis:** analisis batch 1 realtime scan (22 CA acak, 14–20 Okt 2026) +
sesi tanya-jawab 10 pertanyaan atas temuan batch tersebut.

**Kesepakatan dasar (2026-10-20, dikunci sebelum pengembangan dimulai):**
- CA acuan uji LIVE = **Baton** `Hg5Ja55T5wESq4vyFoiVCMeHXtGyVA69X2UHq8hgpump`
  (menggantikan 8DXq; cadangan: OTC `MukLDtJ8Cx9DxLbeyLRSWPSposTMWuwHANbuaudpump`).
- 8DXq tetap **fixture backtest internal** (test p0, skor terkunci 53).
- Tidak ada perubahan arah/tiba-tiba di luar roadmap ini tanpa keputusan Rin.

**Prinsip yang mengikat seluruh roadmap:**
- Phase 9 tetap TERKUNCI (rule, threshold, kontrak evidence, tier).
  Perubahan apa pun di sana butuh keputusan eksplisit Rin (lihat P5).
- Phase 11 sudah dibuka kuncinya oleh Rin — perbaikan agregasi boleh jalan.
- Kejujuran data tidak boleh dikorbankan demi angka: data hilang tidak
  boleh terlihat sebagai kabar baik, di level mana pun.
- Setiap ronde: test penuh + ZIP bernama tanggal/ronde, seperti biasa.

---

## P0 — Kejujuran skor akhir (PALING PENTING) — ✅ SELESAI (Ronde 15, 2026-10-20)

**Masalah (bukti batch 1):** skor akhir dinormalisasi hanya atas dimensi
yang tersedia. Dimensi yang hilang lenyap dari penyebut, sehingga data
hilang menaikkan skor. Korelasi jumlah INSUFFICIENT_DATA vs skor = +0,65.
Kasus ekstrem: LouLou — skor tertinggi 81 "Sangat kuat" dari data paling
rusak (phase 8 hanya 3/52 wallet ter-scan, 11 rule INSUFFICIENT_DATA).

**Pekerjaan (semua di Phase 11, tidak menyentuh Phase 9):**
1. **Gerbang cakupan untuk skor & tier.** Bila dimensi `risk_findings`
   tidak tersedia, ATAU rasio rule INSUFFICIENT_DATA melewati ambang
   (usulan awal: > 1/3 dari 18 rule), maka:
   - skor ditandai **PROVISIONAL**, dan
   - tier diberi plafon (usulan awal: maksimal tier 3 "Sedang").
   Angka mentahnya tetap ditampilkan — yang dibatasi adalah klaimnya.
2. **Headline selalu bertiga:** skor + confidence + `rule_evaluated_pct`
   ditampilkan berdampingan di report HTML dan ringkasan, tidak bisa
   dipisah-pisah.

**Kriteria selesai:** fixture bergaya LouLou (risk unavailable + INSUFFICIENT
tinggi) tidak bisa lagi menghasilkan label "Kuat/Sangat kuat"; test regresi
mengunci perilaku ini.
**Dampak:** kepercayaan pada angka headline. **Usaha:** kecil–sedang.

## P1 — Dimensi hilang & pemisahan dua sumbu sinyal — ✅ SELESAI (Ronde 17, 2026-10-21)

Hasil awal: fee_utility dinyatakan eksplisit TIDAK DIPAKAI per token
(`summary.fee_utility_status` — akar masalahnya gerbang
project_utility_verified yang disengaja, bukan wiring putus; aktivasi =
keputusan kalibrasi P5). Skor ganda tampil via `summary.score_variants`

**Penutup (Ronde 19, keputusan Rin 2026-10-21):** fee_utility
DIAKTIFKAN dengan model M2 — eligibility diperluas ke semua bukti
penggunaan fee terverifikasi, peta netral 50 + 5×skor; tanpa bukti
tetap NOT_USED. Simulasi pra-aktivasi atas 23 scan: 5 token eligible,
dampak −1..−2 poin (Baton 63→61 terverifikasi). P1 SELESAI PENUH.
Kandidat lanjutan (belum dijadwalkan): perdalam bukti Phase 6
(aliran lanjutan fee creator) agar skor fee punya variasi nyata.
+ headline HTML + konsol. token_control jenuh & creator_activity 65
tetap hanya dicatat sebagai kandidat P5.

**Masalah:** `fee_utility` tidak pernah tersedia (22/22) sehingga bobot 10
selalu lenyap; skor dengan DB dan tanpa DB tercampur padahal mengukur
sumbu berbeda (manipulasi on-chain vs keyakinan kerumunan terpantau —
divergen di 21/22 CA).

**Pekerjaan:**
1. Telusuri wiring phase 6 → 10 → 11 untuk `fee_utility`: perbaiki agar
   kontribusinya tersedia, atau nyatakan secara eksplisit tidak dipakai.
   Redistribusi bobot (bila dipilih) = keputusan Rin, dicatat.
2. **Skor ganda di report:** tampilkan skor akhir dengan DB dan tanpa DB
   berdampingan, masing-masing dengan label sumbunya.
3. `token_control` jenuh (rata-rata 100 di token pump.fun) dan
   `creator_activity` yang hampir selalu nilai default 65: **dicatat
   sebagai kandidat kalibrasi (P5), tidak diubah di ronde ini.**

**Kriteria selesai:** tidak ada dimensi yang hilang diam-diam; setiap
dimensi yang tidak tersedia tertulis alasannya di report.
**Usaha:** kecil–sedang.

## P2 — Riwayat scan & dukungan scan ulang (longitudinal) — **✅ SELESAI (Ronde 20, 2026-10-21)**

**Masalah:** `Output/<mint>` ditimpa setiap scan ulang — bukti scan
pertama hilang. Akibatnya LTR-02/LTR-03 (butuh ≥2 snapshot likuiditas)
dan TCR-04 (butuh dua window) tidak pernah terevaluasi (±21/22
INSUFFICIENT_DATA), dan perbandingan "risiko turun asli vs artefak sepi"
tidak punya alat.

**Pekerjaan:**
1. **Arsip otomatis:** sebelum pipeline menulis `Output/<mint>`, hasil
   sebelumnya dipindahkan ke `Output/<mint>/history/<timestamp>/`.
   `liquidity_history.jsonl` tetap di tempatnya (desain LTR-02).
2. **Perbandingan antar-scan di report:** delta skor, delta rule
   TRIGGERED, delta `rule_evaluated_pct`, dengan penanda otomatis:
   risiko turun + cakupan naik/tetap = "perbaikan konsisten";
   risiko turun + cakupan turun = "kemungkinan artefak sepi".
3. Tidak mengubah evaluator Phase 9 — ini murni memberi mereka data
   yang selama ini tidak pernah sampai.

**Kriteria selesai:** scan ke-2 pada mint yang sama menghasilkan riwayat
yang bisa dibandingkan, dan LTR-02 terevaluasi (bukan INSUFFICIENT_DATA)
pada scan ke-2 untuk mint yang likuiditasnya berubah.
**Usaha:** sedang. **Nilai strategis:** tinggi — menghidupkan 3 rule mati
tanpa menyentuh kunci Phase 9.


**Hasil Ronde 20:** `Script/scan_history.js` (arsip otomatis ke `history/<stempel-run>/` sebelum A/C menimpa; jsonl tetap di tempat; arsip gagal = run batal) + `Script/scan_compare.js` (delta lengkap + penanda konsisten/artefak sepi + beda himpunan pool + catatan efek model) + section "Perbandingan Antar-Scan" di report HTML + `scan-comparison.json`. Terverifikasi rehearsal atas dua sampel Baton: semua delta persis sama dengan analisis manual. 230/230 PASS.

## P3 — Coverage phase 8 di bawah kuota trial — **✅ SELESAI (Ronde 21, 2026-10-21)**

**Masalah:** phase 8 adalah phase paling lapar kuota dan paling
menentukan (menghidupkan SPR-01/04, CTR-05, dan separuh rule lain), tapi
antrean walletnya tidak memprioritaskan yang paling menentukan. Kasus
"hi" juga menunjukkan urutan menu yang terlewat merusak 11 rule.

**Pekerjaan:**
1. **Prioritas antrean phase 8:** wallet DB-matched, top holder, dan
   terkait-creator dipindai lebih dulu; sisanya menyusul. Bila limit
   memotong, yang terpotong adalah yang paling tidak menentukan.
2. **Preset retry yang lebih sabar** sebagai opsi config (jeda antar
   retry pass lebih panjang), untuk run yang tidak buru-buru.
3. **Penegakan urutan di pipeline 00:** periksa keberadaan sidecar
   funding-graph/market-volume dan beri peringatan jelas sebelum phase 9
   bila belum ada (mencegah kasus "hi" berulang).

**Kriteria selesai:** pada run yang kena limit, wallet prioritas tetap
berhistori lengkap; CTR-05 berpeluang terevaluasi untuk pertama kalinya.
**Usaha:** sedang.


**Hasil Ronde 21:** antrean Phase 8 bertier (DB-matched > top holder > terkait-creator > lain; `selection_tier` tercatat per wallet) + preset retry config (`standard` 1 pass / `patient` 3 pass jeda 3×/6×/12×) + peringatan sidecar hilang sebelum Phase 9 di semua jalur pipeline. 234/234 PASS. Kriteria pembuktian penuh menunggu run live berikutnya (wallet prioritas kini selalu dipindai paling awal).

## P4 — Label outcome (fondasi kalibrasi)

**Masalah:** tanpa label hasil akhir token, kita hanya tahu rule mana
yang *menyala*, bukan rule mana yang *benar*. Semua keputusan kalibrasi
tanpa ini adalah tebakan.

**Pekerjaan:**
1. Mekanisme follow-up per CA yang sudah discan: catat keadaan pada
   **7 hari dan 30 hari** setelah scan (masih hidup / sudah migrasi /
   mati-rug / harga relatif terhadap saat scan). Semi-manual oleh Rin
   atau snapshot ringan semi-otomatis.
2. Disimpan sebagai file outcome terpisah per mint; tidak mengubah
   output scan yang sudah ada.
3. Target: **≥10 CA berlabel outcome** sebelum P5 dibuka.

**Kriteria selesai:** dataset scan + outcome bisa dibaca berdampingan
per CA. **Usaha:** kecil per CA, tapi butuh konsistensi waktu.

## P5 — Kalibrasi C1–C4 (TERKUNCI — syarat berat)

**Isi kandidat:** C1–C4 yang tertunda sejak backtest, ditambah temuan
batch 1: SPR-02 (menyala 20/22 — kandidat noise), SPR-03/CTR-04/TCR-03
(terevaluasi penuh, tidak pernah menyala), kejenuhan `token_control`,
nilai default `creator_activity`, hipotesis arah TCR-01/TCR-02.

**Syarat masuk (semuanya wajib):**
- Data outcome P4 mencapai ≥10 CA berlabel.
- Keputusan eksplisit Rin per item — setiap perubahan threshold dicatat
  sebagai pembukaan kunci terbatas, bukan kebiasaan baru.

**Catatan:** P5 sengaja di bawah. Membuka kunci tanpa data outcome akan
mengulangi kesalahan kalibrasi lama dengan sampel baru.

---

## Opsional — boleh dikembangkan, boleh dilewatkan

- **Social layer** (filter organik vs bot untuk konteks sosial token):
  pengembangan terpisah; nilai tambah konteks, BUKAN input skor.
- **Refresh benchmark DB otomatis** setelah tiap batch (sekarang manual
  lewat `compute_db_benchmark.js`).
- **Preset dua tahap scan:** pengingat scan utama 12–24 jam setelah scan
  dini, sesuai pola waktu ideal dari tanya-jawab Q5.
- **Ekspor ringkasan batch (CSV)** untuk analisis di luar script.
- **Laporan perbandingan batch** (batch 1 vs batch 2 dst.) setelah P2 —
  sebagian otomatis tertangani oleh riwayat scan.

## Urutan eksekusi yang disarankan

**P0 → P1 → P2 → P3** (berurutan, masing-masing satu ronde),
**P4 berjalan menyertai** scanning rutin, **P5 hanya saat syaratnya
terpenuhi**. Item opsional hanya diambil bila ada waktu dan kebutuhan
nyata — bukan karena tersedia.
