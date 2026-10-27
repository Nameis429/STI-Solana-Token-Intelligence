# Stage 6H — Holder Distribution Intelligence Patch

Status: PATCHED / INTERNAL PASS

## Scope
Audit holder concentration semantics without changing the locked Phase 11 formula or concentration thresholds.

## Finding
The existing adjusted_confirmed_normal metric intentionally excludes only holders with an explicit exclusion flag (currently confirmed LIQUIDITY_POOL and BURN). However, the same adjusted metric can still contain LP_CANDIDATE, PROGRAM, PROGRAM_CONTROLLED, and UNKNOWN classifications. Calling that result "pure normal-holder concentration" would therefore overstate what is known.

## Minimal patch
Preserve the existing raw and adjusted metrics exactly. Add `concentration.classification_cohorts` with explicit cohorts:
- NORMAL_HOLDER
- LIQUIDITY_POOL
- LP_CANDIDATE
- BURN
- PROGRAM
- PROGRAM_CONTROLLED
- UNKNOWN

Each cohort records holder count, amount, supply share, inclusion in adjusted view, and its own distribution metrics.

Add `adjusted_confirmed_normal_metadata` documenting excluded classifications, unresolved/program-controlled classifications still included, denominator supply, and the interpretation boundary.

No scoring, thresholds, Phase 11 weights/formula, or existing adjusted metric semantics were changed.

## Interpretation rule
Raw = all discovered non-zero holders.
Adjusted confirmed normal = legacy adjusted view excluding only explicitly confirmed non-holder classifications.
Unresolved/program-controlled classes remain included and must not be described as pure normal-holder concentration.

## Regression
41/41 PASS.
