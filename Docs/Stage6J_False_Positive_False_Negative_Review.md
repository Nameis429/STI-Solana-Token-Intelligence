# Stage 6J — False Positive / False Negative Review

## Status
PASS — no new false-positive source defect requiring a production patch was established.

## Scope
Review of Phase 9 rule behavior, especially SELL pressure and temporal transfer→SELL evidence, using the current 6H package and regression fixtures. The review does not alter thresholds, scoring, BA, Wallet DB Weight, or Phase 11.

## Confirmed protections
1. Transfer-only events do not trigger SPR-02.
2. Incomplete history does not become NOT_TRIGGERED for SPR-02. If the configured alternative threshold is met, the existing PROVISIONAL status is preserved; this is not silently downgraded to NOT_TRIGGERED.
3. Unsupported/unavailable evaluators return INSUFFICIENT_DATA rather than fabricating NOT_TRIGGERED.
4. CTR-03 remains temporal association only and does not establish ownership, relationship, or causality.
5. Confirmed LIQUIDITY_POOL remains excluded as a wallet-level SPR-02 subject.

## Important false-negative review finding
The current Phase 9 source contains explicit evaluator logic for SPR-02, CTR-03, and CTR-05. The other 15 rules are catalogued and enabled but fall through to the generic INSUFFICIENT_DATA path when their required evaluator implementation/data path is not present.

This is **not classified as a proven false negative** because the available regression artifacts do not demonstrate that the required upstream evidence was simultaneously complete and available for any of those 15 rules while the engine returned INSUFFICIENT_DATA. However, it is an **evaluator coverage gap / future validation target**.

The 15 rules are:
SPR-01, SPR-03, SPR-04, SPR-05,
CTR-01, CTR-02, CTR-04,
TCR-01, TCR-02, TCR-03, TCR-04,
LTR-01, LTR-02, LTR-03, LTR-04.

Do not implement these evaluators during 6J merely to increase trigger counts. Their implementation requires a separate evidence-availability and rule-contract audit.

## Regression
44/44 tests PASS.

No production scoring or threshold changes were made.
