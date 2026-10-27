# Phase 10 Wallet Intelligence — Integration & Regression QA

Date: 2026-09-30
Input baseline: `STI_BA_locked_rules_evaluated.zip`
Test mint: `8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`

## Scope
- Re-run Phase 10 from the archived Phase 2/7/8/9 inputs.
- Run automated project tests.
- Compare legacy Phase 10 outputs before/after rerun.
- Verify Phase 11 artifact remains unchanged.
- Validate BA status accounting and score bounds.

## Results
- `npm test`: 23 passed, 0 failed.
- Phase 10 CLI rerun: exit code 0.
- Wallets processed by Wallet Intelligence: 54.
- BA statuses: AVAILABLE 6, PARTIAL 1, INSUFFICIENT_DATA 47.
- Legacy Phase 10 sections compared against baseline: `summary`, `scoring_method`, `evidence_scores`, `evidence_groups`, and `wallet_scores` were byte-for-byte equivalent after JSON serialization.
- Phase 11 file SHA-256 before/after Phase 10 rerun: unchanged.
- BA is stored separately from DB Weight; no combined score was added.

## Interpretation
The integration passes the current automated checks and preserves the existing Phase 10 scoring outputs and Phase 11 artifact on the supplied test run. This is regression evidence for the supplied fixture, not proof of general BA accuracy or production readiness. The 47 `INSUFFICIENT_DATA` statuses remain explicitly unscored due to evidence limitations.

## Remaining limits
- Only the included test mint/output was replayed; no new on-chain scan was performed.
- BA score validity depends on event coverage, reconciled position ledgers, and correctness of upstream data.
- This QA does not calibrate BA scores against real-world outcomes.
