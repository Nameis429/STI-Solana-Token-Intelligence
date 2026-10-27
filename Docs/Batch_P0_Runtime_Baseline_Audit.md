# STI — Batch P0 Runtime Baseline & Integrity

Date: 2026-10-09 (WIB, UTC+7)
Status: **PATCHED / CONDITIONAL PASS — fresh live scan still required**

## Input package
- `STI_patch_tahap_6_final.zip`
- Input SHA-256: `b1f1507de41597ffff2c937bfccbcdbb8344a4b5657c253b614b512eda5bc37d`

## Confirmed findings
1. `npm test` previously ran zero tests because the package had no `tests/` directory even though package.json declared `node --test tests/*.test.js`.
2. `Config/config.json` stored `helius.api_key` as the non-secret placeholder `Api_key_helius`; phase validation rejected only empty values and `PASTE_` prefixes, so this placeholder could be treated as a configured credential.
3. The stored 8DXq Phase 11 output was version 1.1.1 and lacked the 6M `summary.data_quality` field, although the active Phase 11 source and HTML generator already matched the 6M patch.
4. Embedded `Script/Script.zip` was stale: its Phase 11 and HTML generator did not contain 6M.
5. `Config/phase9_rules.json` is present in this input package.

## Minimal changes
- By user request, all eight Helius-consuming phase modules read credentials from `Config/config.json` (`helius.api_key`). Empty values and the `PASTE_` placeholder are rejected.
- `Config/config.json` now uses the placeholder `PASTE_YOUR_HELIUS_API_KEY_HERE`; replace it locally with the user’s own key.
- README instructions now explain config-backed API key setup; `.env` is not required.
- Added deterministic tests under `tests/p0-runtime.test.js`.
- Rebuilt embedded `Script/Script.zip` from the active JS source files.
- Regenerated Phase 11 and `report.html` for the existing 8DXq fixture from the supplied Phase 1–10 JSON. No live API scan was performed.

## Verification
- JavaScript syntax check: PASS for all `Script/*.js` and `main.js`.
- `npm test`: 6/6 PASS.
- Missing/placeholder config key: Phase 1 fails safely with `HELIUS_API_KEY_NOT_CONFIGURED` before making a request.
- Existing fixture run_id remains `dae97510-8016-411d-a8b4-2c441ba1d015` across scan context, Phase 9, Phase 10, and regenerated Phase 11.
- Phase 11: version `1.2.0-6M`; score 57; weighted sum 4575; available weight 80; raw score 57.1875; final score 57; scoring-support confidence LOW/52.88; data quality CONDITIONAL; numeric data-quality score null.
- HTML contains Data Quality Assessment and Scoring Support Confidence, and no `[object Object]` marker.

## Scope protection
No Phase 11 formula/weights, Phase 10 BA formula, Wallet DB Weight, Phase 9 thresholds, coverage semantics, evidence taxonomy, identity rules, or LP classification changed.

## Remaining gates
- User must replace `helius.api_key` in `Config/config.json` with their own Helius key before scanning. Do not share the configured package.
- Run a fresh full pipeline scan after installing this package; the checked-in 8DXq output is a regenerated report over existing phase artifacts, not a fresh live scan.
- Then continue P1 coverage/provenance audit and finish the full 6L content checklist.
