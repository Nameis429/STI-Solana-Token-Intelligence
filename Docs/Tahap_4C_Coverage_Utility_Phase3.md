# Tahap 4C — Coverage Utility + Phase 3 Holder Coverage

## Tujuan
Mengimplementasikan kontrak coverage universal tahap 4B pada Phase 3 tanpa mengubah formula, bobot, atau aturan scoring Phase 11 maupun semantics Stage 1–3.

## Perubahan

### 1. Coverage utility
File: `Script/coverage_contract.js`

Menyediakan kontrak dasar:
- retrieval mode: `SNAPSHOT`, `PAGINATED_BOUNDED`, `PAGINATED_UNBOUNDED`, `SAMPLED`, `FAILED`, `EMPTY`
- coverage status: `COMPLETE`, `PARTIAL`, `SAMPLED`, `EMPTY`, `UNKNOWN`, `FAILED`
- coverage reason standar
- pagination metadata
- record accounting: requested / observed / retained
- cap metadata
- rate-limit metadata

### 2. Phase 3 holder discovery
File: `Script/phase3_holder_discovery.js`

Perilaku yang dikunci:
- Pagination selesai tanpa cap → `coverage.status = COMPLETE` dan `reason = NO_MORE_DATA`.
- Holder cap tercapai sebelum endpoint selesai → `coverage.status = PARTIAL`, `reason = RECORD_LIMIT`, `cap_triggered = true`, `has_more_possible = true`.
- Query valid dengan 0 account → `coverage.status = EMPTY`, bukan `FAILED`.
- Kegagalan setelah sebagian data berhasil diperoleh → `status = PARTIAL`, bukan klaim complete.
- Retry 429 dicatat dalam metadata rate-limit.
- `records.observed` dan `records.retained` dipisahkan agar truncation terlihat.
- `Phase 3 status` mengikuti coverage untuk COMPLETE/PARTIAL/FAILED; coverage EMPTY tetap merupakan hasil valid tanpa data holder.

## Tidak berubah
- Phase 11 formula dan bobot.
- Stage 1–3 evidence taxonomy.
- Wallet Database Weight.
- Behavior Adjustment.
- Risk scoring.
- Phase 3 holder ranking/aggregation logic selain status/coverage metadata.

## Tests
Tes baru:
- holder cap → PARTIAL
- completed pagination → COMPLETE dengan scope
- zero-result valid query → EMPTY

Regresi seluruh suite:
- **23/23 PASS**

## Batas 4C
4C hanya mencakup coverage utility dan Phase 3 holder discovery. Phase 4–11 belum dimigrasikan pada paket ini.
