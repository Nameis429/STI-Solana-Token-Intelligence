# STI — Tahap 3: Identity Validation & Token Economics
## Implementation Record

Status: **IMPLEMENTED — REGRESSION PASS**

### Locked design

1. `POOL_COIN_CREATOR` remains a protocol/pool role and is not automatically `PROJECT_CREATOR` or `DEV`.
2. Distribution findings distinguish:
   - `FOUND`
   - `NOT_FOUND_WITHIN_COVERAGE`
   - `UNKNOWN`
   - `INSUFFICIENT_DATA`
3. Fee routing is separated from verified economic function.
4. `project_utility_verified` is the single source of truth for `PROJECT_UTILITY_VERIFIED`.
5. A zero score carries semantic context through status/reason/confidence/coverage fields.
6. Evidence status taxonomy:
   - `VERIFIED`
   - `OBSERVED`
   - `CLAIM_ONLY`
   - `UNKNOWN`
   - `PARTIAL`
   - `INSUFFICIENT_DATA`
   - `CONFLICT`
7. Only verified economic evidence is eligible for economic scoring.
8. `UNKNOWN`, `PARTIAL`, and `INSUFFICIENT_DATA` are not penalties.
9. Project/external claims cannot independently create `VERIFIED`.
10. Phase 11 formula and source were not modified.

### Implementation

#### Phase 6
Added explicit separation between:
- `routing_verification`
- `economic_evidence_status`
- `economic_scoring_eligible`
- `evidence_basis`

Routing may be `VERIFIED` while economic function remains `OBSERVED`.

Economic scoring now checks `economic_evidence_status === VERIFIED`, preserving the existing score values and weights while preventing routing-only evidence from qualifying.

Claim result statuses use the locked taxonomy. `CONFLICT` is reserved for positive contradictory evidence.

`project_utility_verified` and classification are guarded so they cannot contradict each other.

#### Phase 5
Creator distribution now reports `NOT_FOUND_WITHIN_COVERAGE` when no direct recipient is found but bounded history indicates more data may exist. This avoids interpreting a partial scan as proof of universal absence.

An `evidence_status` field is also attached to the distribution result.

### Tests

- Existing Stage 1/2 regression tests: PASS
- Stage 3 tests: PASS
- Total: **20/20 PASS**
- JavaScript syntax checks: PASS for all Script files
- Phase 11 SHA-256 unchanged:
  `8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063`

### Important validation note

Existing historical `Output/` JSON files were not rewritten manually. They are retained as historical scan outputs. The new semantics will appear when Phase 5/6 are executed again.
