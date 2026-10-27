# Tahap 2 — Evidence Deduplication & Cross-Category Wallet Aggregation

## Status
Implemented and regression-tested.

## Locked design decisions
1. Evaluators are implemented only where required input data is available and validated.
2. CTR-03 represents temporal association / unverified relationship evidence; it does not establish a verified wallet relationship or causality. CTR-05 requires verified relationship evidence.
3. Evidence identity is canonicalized using transaction signature when available, with deterministic event fingerprint fallback.
4. The same evidence may remain visible in every rule it satisfies, but it is not treated as multiple independent events during aggregation.

## Aggregation levels
### Rule → category + wallet
Within the same category and wallet, an additional rule contributes up to 20% of its risk/evidence score, scaled by its novel-evidence ratio.

### Category + wallet → wallet
The same evidence-aware principle is now applied across categories. Groups for a wallet are ordered by score. The highest-scoring group is the base. Each additional group contributes:

`additional_score × 0.20 × novel_evidence_ratio`

where the novelty ratio is the proportion of that group's evidence identities that have not already appeared in higher-priority groups for the same wallet.

A fully overlapping group therefore contributes 0%. A group with 50% novel evidence contributes 50% of its normal 20% additional contribution.

## Information preservation
The event is not removed from either rule or group. `related_rule_ids`, `evidence_identities`, and group membership continue to show that the same event satisfied multiple rules. Deduplication only controls incremental scoring.

## Phase 11
No Phase 11 formula, weight, tier, DB Weight, or Behavior Adjustment rule was changed.

## Regression
- Unit/regression tests: 11/11 PASS.
- CA `8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`: overlapping wallet risk 87.60 → 82.74; Phase 11 remains 57/100, Tier 3.
- CA `9twiuSdTVkwtAC9XQDG57dFRhF4iqPih461HJfMZKci9`: overlapping wallet risk 87.60 → 81.59; Phase 11 remains 60/100, Tier 3.
- Wallet-risk averages changed only where overlap was previously counted as a full additional group: 66.51 → 65.82 and 67.92 → 66.72.
