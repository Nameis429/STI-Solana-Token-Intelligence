# STI Tahap 4D — Phase 4 Pool Discovery & Owner-Probe Coverage

## Scope
Integrasi Universal Data Coverage Contract 4B ke Phase 4. Tidak mengubah scoring, bobot Phase 9/10, atau formula Phase 11.

## Implemented
- Raydium pool discovery: paginated bounded retrieval with page/record caps and explicit COMPLETE/PARTIAL/EMPTY semantics.
- Meteora DLMM pool discovery: paginated bounded retrieval with page/record caps and explicit coverage.
- Owner probe: requested/selected/preclassified/RPC-probed/successful/failed/unclassified accounting; probe cap becomes PARTIAL.
- Fungible LP holder probe: pagination, page/record caps, observed/retained counts, and coverage.
- Rate-limit metadata for Phase 4 HTTP retrievals; 429 retry recovery is represented in coverage metadata.
- Phase 4 dataset-level coverage and overall coverage aggregation.
- Orca remains UNKNOWN/NOT_AVAILABLE because no verified decoder is enabled; overall coverage therefore cannot falsely become COMPLETE.
- `program_ids_checked` is built as a flat list of program-id strings through `buildProgramIdsChecked()`.
- Root cause fixed: the previous expression spread an outer array whose elements were themselves arrays, so `unique()` received nested arrays and could not flatten them.

## Locked semantics
- COMPLETE always has explicit scope.
- PARTIAL is not a negative finding.
- UNKNOWN is not a negative finding.
- FAILED is retrieval failure, not negative evidence.
- Bounded pagination/cap does not produce absolute absence claims.
- Existing holder concentration and classification logic is preserved.
- Phase 11 source is unchanged.

## Validation
- Full regression after final runtime-path fix: 29/29 PASS.
- Added integration-path tests that exercise the same `buildProgramIdsChecked()` helper used by Phase 4 final `liquidity_mapping` construction and assert no nested arrays.
- Phase 11 SHA-256 unchanged: 8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063.
- A live Phase 4 request was attempted for CA 8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq, but the execution environment returned `fetch failed` for network requests. Therefore live validation is not claimed as PASS and should be performed by the user using the delivered package.

## Current status
Implementation and automated regression: PASS.
Live external API validation: PENDING user run.
