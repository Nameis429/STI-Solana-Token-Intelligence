# STI — Tahap 4F: Phase 6 Coverage Audit & Implementation

## Tujuan
Menerapkan Universal Data Coverage Contract (Tahap 4B) pada Phase 6 — Fee / Trading Economics Intelligence tanpa mengubah formula scoring, bobot Phase 11, atau aturan evidence Stage 3.

## Temuan audit
1. Phase 6 sengaja menggunakan bounded transaction sampling.
2. Pool history mengambil bounded signature pool lalu memilih sampel HYBRID.
3. Downstream recipient history juga bounded dan sampled.
4. Output lama menyatakan top-level `status=COMPLETE` walaupun retrieval sebenarnya sampled.
5. Output lama belum menyediakan universal coverage object untuk dataset transaksi Phase 6.
6. Request retry sudah ada, tetapi status rate-limit belum dipropagasikan sebagai metadata coverage.
7. Kegagalan mengambil detail transaksi individual sebelumnya hanya tersimpan sebagai error global tanpa coverage dataset yang eksplisit.

## Implementasi
### Sampling coverage
Setiap pool/downstream transaction dataset sekarang mempunyai:
- `retrieval_mode: SAMPLED`
- `status: SAMPLED` bila sampling selesai tanpa retrieval failure
- `status: PARTIAL` bila signature retrieval atau transaction-detail retrieval mengalami failure
- `reason: SAMPLE_LIMIT` atau `REQUEST_FAILED`
- `scope: SAMPLE_WINDOW`
- `has_more_possible: true`
- records requested / observed / retained
- cap information
- rate-limit metadata

### Top-level Phase 6
Top-level `coverage` sekarang merangkum dataset pool dan downstream.
Top-level `status` tidak lagi `COMPLETE` untuk analisis sampled-only:
- `SAMPLED` = analisis berhasil tetapi bounded/sample-based
- `PARTIAL` = terdapat retrieval failure pada dataset sampled
- `EMPTY` = tidak ada dataset sample yang berhasil tersedia

`SAMPLED` bukan error; ini adalah status coverage yang jujur.

### Rate limit
HTTP 429 sekarang dicatat dalam `retrieval_metrics.rate_limit`:
- encountered
- retry_count
- recovered
- final_state

### Tidak berubah
- Phase 6 fee score formula.
- Evidence taxonomy Stage 3.
- `project_utility_verified` sebagai single source of truth.
- Phase 9 rules.
- Phase 10 scoring.
- Phase 11 formula dan bobot.
- Phase 11 source SHA-256: `8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063`.

## Regression
`npm test` → **41/41 PASS**.

## Catatan sumber API
Solana `getSignaturesForAddress` mendukung pagination melalui `before`/`until`; Phase 6 saat ini tetap sengaja menggunakan retrieval bounded untuk sampling, bukan mengubah Phase 6 menjadi full-history scanner. Helius juga menyediakan `getTransactionsForAddress` dengan pagination untuk archival history, tetapi migrasi penuh ke metode tersebut bukan bagian Tahap 4F. Hal ini menjaga scope Phase 6 tetap targeted/sampled.
