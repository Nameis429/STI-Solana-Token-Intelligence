# STI — BATCH 8 CROSS-PHASE INTEGRITY AUDIT

Date: 2026-10-07 WIB (UTC+7)

## 1. Objective

Batch 8 validates the current seven-CA regression package at cross-phase level without performing realtime RPC.

Scope:
- artifact completeness across Phase 1–11;
- run_id and mint consistency;
- Phase 11 internal arithmetic;
- locked Phase 11 fee-utility eligibility behavior;
- preservation of Phase 6/9 fixes;
- confirmation that the historical 7-CA outputs are stale rather than silently accepted as current-source output.

No scoring formula, weight, threshold, or coverage rule was changed.

## 2. Dataset

The Batch 7 package contains exactly 7 CA datasets. Each dataset contains Phase 1–11 plus scan context.

## 3. Internal regression

After adding the Batch 8 cross-phase tests:

- tests: 35
- PASS: 35
- FAIL: 0
- skipped: 0
- cancelled: 0

Fresh execution from the extracted package: **35/35 PASS**.

## 4. Cross-phase integrity

For all 7 CAs:
- 11/11 phase artifacts present;
- one consistent run_id across phases;
- mint/CA identity consistent;
- Phase 11 output internally matches its own locked weighted arithmetic and rounding.

Result: **PASS**.

## 5. Fee-utility eligibility audit

The current Phase 11 source explicitly contains the PH6-43/44/45 eligibility behavior.

Historical 7-CA Phase 11 artifacts still contain:
- fee_utility score = 1;
- available = true;
- source score = 0;

This occurs in all 7 historical artifacts.

Current-source unit tests independently verify that:
- UNKNOWN/INSUFFICIENT_DATA utility is not available as a numeric dimension;
- verified utility with score 0 remains available;
- unavailable utility is not rendered as a numeric negative score;
- Phase 6 provenance is carried forward.

Result: **current source behavior PASS; historical artifact freshness FAIL/BLOCKED**.

## 6. Phase 9 / liquidity-pool protection

Batch 7 already established 7/7 current-source Phase 9 reproducibility and no CbR2 liquidity-pool wallet subject in the supplied 7-CA artifacts. The dedicated Phase 9 liquidity-pool regression test also passes.

Result: **PASS**.

## 7. Interpretation

The remaining discrepancy is an artifact-generation issue, not a reason to modify scoring.

The correct next action remains:

1. run the seven CAs with the exact current source package;
2. regenerate Phase 6–11 outputs;
3. rerun Batch 7 and Batch 8;
4. compare current-source output to regenerated output;
5. close Stage 5 only after the regenerated artifacts agree.

Realtime testing is intentionally deferred. It is not required to establish this static cross-phase integrity finding.

## 8. Gate result

### PASS
- 7-CA artifact completeness
- run_id consistency
- mint consistency
- Phase 11 internal arithmetic
- current PH6-43/44/45 eligibility behavior
- Phase 9 liquidity-pool regression
- full internal suite: 35/35

### BLOCKING
- historical Phase 11 outputs are stale and still encode fee_utility as available.

## 9. Final status

**BATCH 8 — BLOCKED / WAITING FOR FRESH 7-CA REGENERATION**

No source patch is justified by the Batch 8 findings.
