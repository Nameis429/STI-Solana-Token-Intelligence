# STI — Tahap 4E: Phase 5 Coverage & Retrieval

Status: IMPLEMENTED / REGRESSION PASS
Tanggal: 2026-10-02

## Tujuan

Menerapkan Universal Data Coverage Contract Tahap 4B pada Phase 5 tanpa mengubah formula scoring, bobot Phase 11, atau semantics Stage 1–3.

## Temuan audit source

1. Initial distribution sudah memakai `getTransactionsForAddress` dan pagination token, tetapi metadata masih berupa struktur lokal dan belum menjadi universal coverage object.
2. `getTransfersByAddress` untuk creator hanya mengambil `limit:100` dalam satu request. Endpoint tersebut mendukung cursor pagination, sehingga satu halaman tidak boleh diperlakukan sebagai seluruh history.
3. Enhanced creator history sudah memiliki bounded pagination, tetapi belum menerbitkan coverage metadata universal.
4. Retry 429 belum mencatat `Retry-After` dan metadata rate-limit secara terstruktur.
5. Status Phase 5 dapat tetap `COMPLETE` ketika initial distribution sebenarnya berhenti karena page cap.
6. Creator distribution menggunakan konteks coverage initial distribution untuk menentukan status outbound creator transfer; ini tidak tepat karena kedua dataset berasal dari retrieval yang berbeda.
7. `NO_SELL_DETECTED` terlalu absolut ketika enhanced history masih bounded/partial.

## Implementasi

### 1. Universal coverage object

Phase 5 sekarang memiliki:

- `coverage.initial_distribution`
- `coverage.creator_transfers`
- `coverage.creator_enhanced_history`
- `coverage.related_wallets`
- `coverage.overall`

Coverage menggunakan contract yang sama dengan Phase 3/4.

### 2. Initial distribution

Pagination `getTransactionsForAddress` tetap dipertahankan.

Jika configured page cap tercapai sebelum pagination selesai:

- status: `PARTIAL`
- reason: `PAGE_LIMIT`
- `has_more_possible: true`

Jika pagination selesai secara normal:

- status: `COMPLETE`
- reason: `NO_MORE_DATA`
- scope: `FULL_AVAILABLE_DATA`

### 3. Creator transfer history

`getTransfersByAddress` sekarang menggunakan `paginationToken` dan configured page cap.

Config baru:

- `creator_transfer_max_pages`: default 10
- `related_transfer_max_pages`: default 5

Display recipient cap tetap terpisah dari retrieval cap. Total transfer menggunakan seluruh recipient yang berhasil ditemukan dalam retrieval, bukan hanya recipient yang ditampilkan.

### 4. Enhanced history

Coverage metadata ditambahkan untuk bounded `before-signature` pagination.

Page cap tidak lagi dianggap complete.

### 5. Rate limit

HTTP 429 sekarang:

- dicatat sebagai rate-limit encounter;
- menghitung retry;
- membaca `Retry-After` bila tersedia;
- menggunakan delay terbesar antara exponential backoff dan `Retry-After`;
- mencatat `RECOVERED` atau `RETRY_EXHAUSTED`.

### 6. Not-found semantics

Creator distribution kosong tidak lagi menjadi klaim universal tidak ada distribusi.

Status yang digunakan:

- `FOUND`
- `NOT_FOUND_WITHIN_COVERAGE`
- `UNKNOWN`
- `INSUFFICIENT_DATA`

Untuk sell history yang tidak menemukan sell pada history terbatas, digunakan `NO_SELL_OBSERVED_WITHIN_COVERAGE`.

### 7. Overall Phase 5 status

Phase 5 tidak boleh lagi menghasilkan `COMPLETE` apabila dataset coverage inti masih `PARTIAL`, `UNKNOWN`, `SAMPLED`, atau `FAILED`.

`PARTIAL` hanya menjelaskan keterbatasan retrieval; bukan penalti dan bukan negative finding.

## Tidak diubah

- Phase 11 formula.
- Phase 11 weights.
- Phase 9 rules.
- Stage 1 integrity rules.
- Stage 2 evidence dedup / novelty ratio.
- Stage 3 identity/evidence taxonomy.
- Creator ≠ developer semantics.
- `POOL_COIN_CREATOR` tetap terpisah.

## Regression

Sebelum Tahap 4E: 29/29 PASS.

Sesudah Tahap 4E: **37/37 PASS**.

Phase 11 source SHA-256 tetap:

`8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063`

## Catatan validasi realtime

Package source ini tidak melakukan realtime scan otomatis pada tahap audit karena config yang dibundel menggunakan placeholder `API_KEY_HELIUS`. Realtime validation harus dilakukan menggunakan config pengguna yang memiliki API key aktif.

## Referensi API

Helius mendokumentasikan `getTransactionsForAddress` dengan cursor `paginationToken`, dan `getTransfersByAddress` dengan cursor `paginationToken` hingga 100 record per page. Karena itu, kedua endpoint diperlakukan sebagai paginated retrieval, bukan snapshot satu halaman.
