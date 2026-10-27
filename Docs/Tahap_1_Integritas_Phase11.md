# Tahap 1 — Integritas Data dan Validasi Phase 11

Tanggal: 2026-09-30

## Tujuan

Memperkuat validasi provenance Phase 1–10 sebelum data digunakan oleh Phase 11, tanpa mengubah formula, bobot, tier, atau metode scoring Phase 11.

## Perubahan

1. **Validasi scan context**
   - `scan-context.json` sekarang dipakai sebagai sumber pembanding `run_id` dan mint bila tersedia.
   - `run_id` phase yang berbeda dari scan context menghasilkan error integritas.
   - Mint pada scan context yang berbeda dari target menghasilkan error.

2. **Validasi run_id**
   - Semua `run_id` Phase 1–10 harus konsisten.
   - Campuran beberapa `run_id` menghasilkan `RUN_ID_MISMATCH`.
   - Hasil legacy tanpa `run_id` tetap didukung dan diberi warning, bukan dianggap negatif.

3. **Validasi provenance phase dan mint**
   - `provenance.phase` diperiksa terhadap nomor phase yang sebenarnya.
   - `provenance.mint` diperiksa terhadap mint target.

4. **Validasi timestamp**
   - Timestamp yang ada tetapi tidak dapat diparse menghasilkan error `TIMESTAMP_INVALID`.
   - Timestamp yang valid tetapi urutannya mundur menghasilkan `TIMESTAMP_ORDER_WARNING`, sehingga tidak langsung dianggap fatal karena phase dapat dijalankan ulang secara manual.
   - Timestamp yang tidak tersedia pada hasil legacy menghasilkan warning.

5. **Missing phase**
   - Phase yang tidak tersedia tetap menjadi warning dan menyebabkan laporan dapat berstatus PARTIAL.
   - Missing phase tidak dikonversi menjadi sinyal negatif atau skor nol.

6. **Null risk score**
   - `null`, `undefined`, string kosong, atau nilai non-numerik tidak dianggap sebagai skor risiko 0.
   - Evidence group tanpa skor numerik dikeluarkan dari agregasi risiko.
   - Jika seluruh evidence group tidak memiliki skor numerik, dimensi `risk_findings` menjadi unavailable (`score: null`) dan tidak diberi nilai negatif maupun positif.

## Regression Test

Test suite Tahap 1 mencakup:

- pipeline lengkap yang sinkron;
- mixed `run_id`;
- mint mismatch;
- provenance phase mismatch;
- provenance mint mismatch;
- invalid timestamp;
- timestamp order warning;
- missing phase;
- partial/null Phase 10 risk;
- seluruh risk score null.

Hasil terakhir: **7/7 PASS, 0 FAIL**.

## Regression terhadap hasil scan nyata

Dua hasil scan yang digunakan sebagai baseline:

- `8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`
- `6qBR7sk15ZVdt1vx6j1JgtkuurK8WrapugFptWQCyzL6`

Keduanya lolos validasi integritas baru tanpa warning/error.

Kedua hasil tetap menghasilkan:

- Final Score: **57/100**
- Classification: **Tier 3 — Sedang**
- Confidence: **MEDIUM (57.78/100)**
- Coverage: **54.22%**

Perbandingan semantic fields sebelum dan sesudah validasi menunjukkan tidak ada perubahan pada field scoring utama.

## Batasan

Perubahan ini memperkuat integritas input dan pengujian. Tidak mengubah formula Phase 11, bobot dimensi, tier, atau interpretasi skor.
