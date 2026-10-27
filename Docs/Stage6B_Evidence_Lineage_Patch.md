# STI Stage 6B — Evidence Lineage Patch

## Scope
Minimal lineage-only patch. No scoring, threshold, coverage, BA, DB Weight, or Phase 11 formula changes.

## Changes
1. Phase 8 events now carry a stable `event_id` scoped to signature/event class/event observation order.
2. Phase 8 events carry `transaction_provenance` with signature/source/slot/block_time.
3. Phase 9 `evidence_refs` preserve `event_id`, `signature`, source, and transaction provenance.
4. Added regression tests for Phase 8 -> Phase 9 evidence lineage.

## Target lineage
Phase 11 -> Phase 10 evidence group -> Phase 9 rule -> Phase 8 event_id -> transaction signature -> transaction provenance.

## Validation
`npm test`: 39/39 PASS, 0 FAIL.

The real 8DXq runtime scan had 49/49 Phase 8 histories rate-limited, so it cannot validate a new triggered finding at runtime. The regression fixture validates the lineage contract without requiring external API access.
