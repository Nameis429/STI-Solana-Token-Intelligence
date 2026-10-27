# STI Batch 4 — Test & Baseline Reconciliation

Date: 2026-10-06 (WIB)

## Findings addressed

- TEST-01 — Phase 11 test expectation drift (`74` vs fixture-derived result)
- TEST-02 — Phase 5 coverage expectation drift (`FULL_AVAILABLE_DATA` vs bounded page cap)
- TEST-PORTABILITY-01 — Phase 9 regression test depended on runtime Output fixture
- PH6-20 / PH6-32 — regression confirmation of protocol-state status finalization

## Rules

Batch 4 does not change locked scoring or coverage semantics. Tests are aligned
to the production contract; production code is not weakened to satisfy stale
assertions.

## Result

Fresh package:

- 30 tests
- 30 PASS
- 0 FAIL
- 0 skipped
- 0 cancelled

The official historical baseline remains 54 tests and must be rerun separately
for the final Stage 5B gate. Seven-CA regression also remains pending.
