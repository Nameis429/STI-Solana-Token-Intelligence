# STI — BATCH 7 FINAL 7-CA REGRESSION AUDIT

Date: 2026-10-07 WIB (UTC+7)

## 1. Objective

Batch 7 is the final seven-CA regression gate before Stage 5 closure.

Scope:
- validate the supplied 7-CA dataset;
- validate Phase 1–11 structural integrity;
- verify run_id and mint consistency;
- verify Phase 6/8 coverage invariant `requested >= observed >= retained`;
- independently rerun Phase 9 using the current Phase 9 source;
- independently rerun Phase 11 using the current Phase 11 source;
- compare historical scan outputs against the current locked source;
- verify that no scoring/threshold/coverage rule was changed merely to make the regression pass.

## 2. Dataset

Input archive:
`hasil_scan_7_ca.zip`

SHA-256:
`0f3c17aef40438d798a21c72ca0c6205adf88f96c821e673a7a068faae8a8db6`

The archive contains exactly 7 CA directories:

1. `5g9PWcRUHpmqm5uKycpShKXJB18sGLeCEzgB3qrRpump`
2. `7ukDd3E3PSupATuK4yvJ49jyZr8nNrkXKcq8pioiq98F`
3. `9UtaRjir5Q4HRG8d8Z8F7jRgHGLBBwp7PR4rgBnoyr3z`
4. `DAemPFNc3RtibBDKkUA4eL2Ns11q9VRdbpptmqm8DGqN`
5. `FYZcYCHSp8FzNba1UtDZydKKGosmxVNpFBiVuia38AhT`
6. `FbKRne8ZDbDyoeD3b22k8EYLWxp8ksCd8a8mMkx6zsXQ`
7. `FvMLDEUDKUr9C34e8Nynz5Aqfdk34a2RBKQxygLpfomo`

Each CA contains Phase 1–11 results and scan context.

## 3. Internal automated regression

Current accessible source package was extracted from the Batch 6 audit package.

`npm test` result after adding the Batch 7 seven-CA regression test:

- tests: 31
- PASS: 31
- FAIL: 0
- skipped: 0
- cancelled: 0

The new Batch 7 regression test verifies for all 7 CAs:
- exactly 11 phase artifacts;
- one consistent run_id across phases;
- mint/CA consistency;
- Phase 9 contains exactly 18 rules;
- Phase 11 arithmetic matches the locked weighted formula and rounding behavior;
- Phase 6 and Phase 8 coverage objects satisfy `requested >= observed >= retained`;
- `CbR2...` is not a wallet subject of SPR-02.

Result: **PASS — internal source regression 31/31.**

## 4. Phase 9 current-source rerun

Phase 9 was independently rerun from the supplied Phase 4/5/8 artifacts using the current Phase 9 source.

All 7 CAs reproduced the supplied Phase 9 rule results exactly (ignoring generated timestamps):

- 5g9P: 2 TRIGGERED / 16 INSUFFICIENT_DATA
- 7ukD: 2 / 16
- 9Uta: 2 / 16
- DAem: 2 / 16
- FYZc: 2 / 16
- FbKR: 1 / 17
- FvML: 2 / 16

No `SPR-02` wallet subject was `CbR2UL7ktBr8MUUTj3FYcURZerp28GA2p1vPuMeKy1Je` in any of the 7 datasets.

Result: **PASS — Phase 9 current-source reproducibility.**

Important limitation: the 7-CA dataset does not contain the known `CbR2...` PumpSwap pool, so the real-network CbR2 case itself is not present in these 7 outputs. The dedicated current-source Phase 9 liquidity-pool regression test remains the direct validation for that case and passes.

## 5. Phase 11 current-source rerun — FINDING

Phase 11 was independently rerun from the supplied Phase 1–10 artifacts using the current Phase 11 source.

The current source does NOT reproduce the historical Phase 11 scores. This is a genuine regression-artifact mismatch and must not be hidden by changing the source or the expected score.

Observed across all 7 CAs:

| CA group | Historical score | Current-source score | Difference |
|---|---:|---:|---:|
| 5g9P / 7ukD / 9Uta / FbKR / FvML | 42 | 47 | +5 |
| DAem / FYZc | 51 | 57 | +6 |

The difference is isolated to the `fee_utility` dimension.

Historical output:
- `score = 1`
- `available = true`
- source score = 0
- confidence = LOW

Current locked Phase 11 source:
- `score = null`
- `available = false`
- `project_utility_verified = false`
- `project_utility_evidence_status = INSUFFICIENT_DATA`
- `eligibility_status = NOT_AVAILABLE`

This behavior matches the locked PH6-43/44 and PH6-45 design: an UNKNOWN/INSUFFICIENT_DATA utility dimension must not be converted into a numeric available score merely because the source numeric score happens to be zero.

Therefore the historical 7-CA outputs are stale relative to the current locked Phase 11 source.

## 6. Interpretation of the finding

This is **NOT a new Phase 11 formula defect**.

The current source correctly excludes the unavailable fee_utility dimension from the denominator. The historical artifacts were generated before the fee-utility eligibility behavior was reflected in the final Phase 11 output.

The correct remediation is:

1. do NOT change the locked Phase 11 formula;
2. do NOT change the PH6-43/44 eligibility rule;
3. regenerate Phase 6–11 for the seven CAs using the exact current source package and valid runtime credentials/data;
4. rerun Batch 7 against those regenerated artifacts;
5. only then close the final seven-CA regression gate.

No source patch was made in Batch 7 for this finding.

## 7. Security/config status

The accessible current source config contains:
`api_key: "API_KEY_HELIUS"`

This is a placeholder-like value, not an exposed runtime secret. The historical baseline secret finding is therefore not reproduced as an exposed credential in this package.

The exact historical Batch 5 ZIP was not available in this runtime, so Batch 7 does not claim execution of that exact package.

## 8. Batch 7 gate result

### PASS
- 7-CA dataset presence: 7/7
- structural Phase 1–11 integrity
- run_id consistency
- mint consistency
- coverage invariant
- Phase 9 current-source reproducibility: 7/7
- internal automated suite: 31/31
- current Phase 9 LP exclusion test

### BLOCKING FINDING
- Phase 11 historical outputs are stale against the current locked Phase 11 eligibility logic.
- 7/7 CAs require Phase 6–11 regeneration before final Stage 5 closure.

## 9. Final status

**BATCH 7 — BLOCKED / NOT CLOSED**

This is intentional. The regression gate correctly detected a cross-CA artifact mismatch instead of silently accepting stale scores.

No scoring weights, Phase 11 formula, Phase 9 thresholds, or coverage semantics were changed to force a PASS.

## 10. Next required execution

Run the seven CAs again with the exact current source package, producing fresh Phase 6–11 artifacts, then execute this same Batch 7 regression suite.

Expected condition for closure:
- current-source Phase 11 output and regenerated artifacts agree for all 7 CAs;
- fee_utility is unavailable when `project_utility_verified=false`;
- final scores use the locked denominator behavior;
- all 31+ regression tests remain PASS.
