# Stage 4I — Coverage Consumption Phase 9/10

## Tujuan
Menghubungkan universal coverage Phase 3–8 dengan evaluator Phase 9 dan scoring/Behavior Adjustment Phase 10 tanpa mengubah formula scoring.

## Perubahan
- Phase 8 history kini memiliki universal coverage object:
  - PAGINATED_BOUNDED
  - COMPLETE / PARTIAL
  - NO_MORE_DATA / PAGE_LIMIT
  - CONFIGURED_PAGE_WINDOW
  - pagination + record accounting + rate_limit metadata.
- Phase 8 overall status menjadi PARTIAL bila terdapat history wallet yang PARTIAL.
- Phase 9 membaca `history.coverage.status` lebih dahulu, dengan fallback legacy untuk kompatibilitas.
- Phase 9 tidak mengubah evidence yang benar-benar terobservasi menjadi INSUFFICIENT_DATA hanya karena coverage parsial; rule yang benar-benar terpicu tetap dapat dinilai, dengan data_quality yang menunjukkan partial observed events.
- Phase 10 coverage summary membaca universal coverage dan mempertahankan coverage sebagai dimensi terpisah dari risk score.
- Behavior Adjustment menggunakan universal coverage status untuk menentukan apakah history cukup lengkap untuk perhitungan no-sell/ledger-dependent.
- `data_coverage` wallet Phase 10 sekarang membawa coverage_status dan coverage_reason.

## Invariants
- PARTIAL/UNKNOWN/FAILED/SAMPLED bukan negative evidence.
- INSUFFICIENT_DATA tidak diberi risk score.
- NOT_TRIGGERED hanya dipertahankan bila evaluator benar-benar memiliki coverage memadai.
- Evidence identity/deduplication Stage 2 tetap.
- DB Weight dan Behavior Adjustment tetap terpisah.
- Formula dan bobot Phase 11 tidak berubah.

## Audit scan nyata
Scan: 8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq

- Phase 8: 47 wallet; 9 complete; 38 partial.
- Normalized coverage Phase 9: PARTIAL; 9 complete / 38 partial.
- Phase 9: 18 rules; 2 TRIGGERED; 16 INSUFFICIENT_DATA.
- Phase 10 BA: 6 AVAILABLE; 3 PARTIAL; 38 INSUFFICIENT_DATA.
- Hasil BA tetap sama dengan hasil sebelum konsumsi universal coverage.

## Regression
52/52 PASS.

Phase 11 source SHA-256 tetap:
`8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063`

Status: CLOSED.
