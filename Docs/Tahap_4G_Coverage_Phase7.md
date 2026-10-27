# STI — Tahap 4G: Phase 7 Coverage Audit

Status: CLOSED — source audit + regression

## Scope
Phase 7 — Database Wallet Matching and bounded token-history retrieval.

## Findings and fixes
1. Phase 7 history was bounded by configurable page count but did not expose the universal Coverage Contract object.
2. Added `phase7HistoryCoverage()` to `Script/coverage_contract.js`.
3. Each wallet history now exposes a universal `coverage` object with retrieval mode, status, reason, scope, pagination, record accounting, caps, and rate-limit metadata.
4. A history that reaches the configured page cap is `PARTIAL / PAGE_LIMIT`, with `has_more_possible=true`.
5. A history ending before the page cap is `COMPLETE / NO_MORE_DATA` within `CONFIGURED_PAGE_WINDOW`; this is not a lifetime-complete claim.
6. A valid empty completed history is `EMPTY / NO_MATCH`.
7. Failed/rate-limited retrieval is `FAILED`, not negative evidence.
8. When bounded history finds no token event, the result is `NOT_FOUND_WITHIN_COVERAGE` if the history is partial; absolute absence is retained only when the bounded retrieval itself completed.
9. If history scanning is disabled, aggregate coverage is `UNKNOWN / NOT_AVAILABLE`, not `EMPTY`.
10. Phase 7 database matching and position-score behavior were not changed.

## Regression
47/47 tests PASS.

Phase 11 source SHA-256 remains:
`8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063`

## Realtime
Realtime validation is deferred. This stage is considered closed based on source audit and regression, consistent with the decision to defer realtime validation for Stage 4F.
