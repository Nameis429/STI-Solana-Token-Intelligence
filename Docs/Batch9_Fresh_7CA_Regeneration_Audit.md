# STI — Fresh 7-CA Regeneration Audit

## Objective
Regenerate the 7-CA Phase 11 outputs using the current locked source semantics, without changing Phase 11 formula, weights, coverage contract, Phase 9 thresholds, or Phase 10 scoring.

## Scope
- Existing Phase 1–10 regression artifacts for 7 CAs were used as the upstream dataset.
- Phase 11 was regenerated from those Phase 1–10 inputs using the current `Script/phase11_final_report.js`.
- This is a **fresh Phase 11 regeneration**, not a new realtime RPC scan.
- Historical Phase 11 outputs were preserved separately for stale-artifact comparison.

## Result
| CA | Historical Score | Regenerated Score | Fee Utility Historical | Fee Utility Current |
|---|---:|---:|---|---|
| 5g9PWcRUHpmqm5uKycpShKXJB18sGLeCEzgB3qrRpump | 42 | 47 | available | unavailable |
| 7ukDd3E3PSupATuK4yvJ49jyZr8nNrkXKcq8pioiq98F | 42 | 47 | available | unavailable |
| 9UtaRjir5Q4HRG8d8Z8F7jRgHGLBBwp7PR4rgBnoyr3z | 42 | 47 | available | unavailable |
| DAemPFNc3RtibBDKkUA4eL2Ns11q9VRdbpptmqm8DGqN | 51 | 57 | available | unavailable |
| FYZcYCHSp8FzNba1UtDZydKKGosmxVNpFBiVuia38AhT | 51 | 57 | available | unavailable |
| FbKRne8ZDbDyoeD3b22k8EYLWxp8ksCd8a8mMkx6zsXQ | 42 | 47 | available | unavailable |
| FvMLDEUDKUr9C34e8Nynz5Aqfdk34a2RBKQxygLpfomo | 42 | 47 | available | unavailable |

The score changes are the expected consequence of PH6-43/44/45 eligibility semantics: unknown/unverified project utility is not a numeric available dimension and is excluded from the Phase 11 denominator. No formula or weight was changed.

## Internal Regression
- Automated tests: **35/35 PASS**
- Batch 7 7-CA regression: **7/7 PASS**
- Cross-phase integrity: **7/7 PASS**
- Phase 11 arithmetic: **7/7 PASS**
- Coverage invariants: **PASS**
- Phase 9 liquidity-pool protection: **PASS**

## Important Boundary
This package does **not** claim a realtime Solana/RPC rerun. Realtime validation remains a separate final validation gate.

## Status
**FRESH 7-CA PHASE 11 REGENERATION — PASS**

The previous stale Phase 11 artifacts are retained under `Historical7CA/` and are not used as the current outputs.
