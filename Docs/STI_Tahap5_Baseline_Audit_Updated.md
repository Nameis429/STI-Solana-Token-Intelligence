# SOLANA TOKEN INTELLIGENCE (STI)

## TAHAP 5 --- BASELINE AUDIT, REGRESSION & SYSTEM VALIDATION

### Updated Audit Record --- Baseline + Phase 6 Deep Audit

**Status dokumen:** ACTIVE AUDIT RECORD\
**Tanggal update:** 6 Oktober 2026\
**Zona waktu dokumentasi:** WIB (UTC+7)

------------------------------------------------------------------------

# 1. TUJUAN DOKUMEN

Dokumen ini merupakan dokumentasi resmi Tahap 5 setelah baseline freeze
dan audit lanjutan terhadap sistem STI.

Dokumen ini melanjutkan fondasi yang telah dikunci pada:

`STI_Tahap1-4J_Dokumentasi_Final.md`

Tahap 1--4J tetap dianggap **CLOSED / LOCKED**. Dokumen ini tidak
membuka kembali keputusan desain yang sudah dikunci kecuali ditemukan
bukti konkret bahwa implementasinya melanggar kontrak tersebut.

Fokus Tahap 5:

1.  Freeze baseline aktual.
2.  Regression seluruh sistem.
3.  Regression menggunakan dataset 7 CA.
4.  Structural regression.
5.  Behavioral regression.
6.  Scoring regression.
7.  Coverage-to-score regression.
8.  Evidence lineage audit.
9.  False-finding / false-negative / false-positive review.
10. Validasi konsistensi antar-phase.
11. Audit HTML/report.
12. Dokumentasi semua temuan.
13. Klasifikasi prioritas setiap temuan.
14. Menentukan root cause sebelum patch.
15. Menentukan remediation secara minimal dan terkontrol.
16. Regression ulang setelah remediation.

**Prinsip utama:**

> AUDIT ACTUAL DATA → IDENTIFY PROBLEM → ROOT CAUSE → MINIMAL PATCH →
> TEST → REGRESSION → OUTPUT VALIDATION

Tidak ada patch yang dilakukan hanya karena hasil satu token terlihat
tidak sesuai ekspektasi.

------------------------------------------------------------------------

# 2. STATUS FONDASI SEBELUM TAHAP 5

Tahap berikut tetap CLOSED:

  Tahap      Status
  ---------- --------
  Tahap 1    CLOSED
  Tahap 2    CLOSED
  Tahap 3    CLOSED
  Tahap 4B   CLOSED
  Tahap 4C   CLOSED
  Tahap 4D   CLOSED
  Tahap 4E   CLOSED
  Tahap 4F   CLOSED
  Tahap 4G   CLOSED
  Tahap 4H   CLOSED
  Tahap 4I   CLOSED
  Tahap 4J   CLOSED

Locked foundations:

-   Phase 11 production formula: **LOCKED**
-   Phase 11 weights: **LOCKED**
-   Coverage taxonomy: **LOCKED**
-   Evidence taxonomy: **LOCKED**
-   Evidence lineage model: **LOCKED**
-   Identity / token economics semantics: **LOCKED**
-   Wallet Database Weight / Behavior Adjustment separation: **LOCKED**
-   `project_utility_verified`: **single source of truth**
-   `POOL_COIN_CREATOR` tetap terpisah dari `PROJECT_CREATOR` / `DEV`
-   Timeline/report menggunakan WIB (UTC+7)
-   `UNKNOWN`, `PARTIAL`, `INSUFFICIENT_DATA`, `FAILED` bukan otomatis
    negative finding
-   `SAMPLED` bukan `COMPLETE`
-   Partial coverage tidak boleh menghasilkan klaim absolut
-   Coverage tidak boleh dinaikkan downstream tanpa retrieval baru
-   Evidence yang sama tidak boleh dihitung berulang sebagai evidence
    independen

------------------------------------------------------------------------

# 3. SKALA PRIORITAS TEMUAN

Setiap temuan Tahap 5 wajib diklasifikasikan.

## P0 --- CRITICAL

Masalah fundamental terhadap integritas sistem.

Contoh:

-   score secara fundamental tidak dapat dipercaya;
-   data antar-phase salah total;
-   false finding besar yang dapat mengubah keputusan utama;
-   security/data integrity failure yang langsung membahayakan sistem.

**Tindakan:** harus ditangani sebelum regression dianggap valid.

## P1 --- HIGH

Masalah yang dapat memengaruhi:

-   evidence;
-   verification;
-   attribution;
-   scoring;
-   downstream phase;
-   semantic correctness.

**Tindakan:** remediation prioritas tinggi sebelum final Stage 5 close.

## P2 --- MEDIUM

Masalah yang memengaruhi:

-   output consistency;
-   coverage semantics;
-   diagnostic quality;
-   provenance;
-   efficiency;
-   maintainability.

Tidak selalu mengubah score secara langsung.

**Tindakan:** diperbaiki setelah P1 atau jika remediation-nya menjadi
bagian langsung dari patch P1.

## P3 --- LOW

Masalah:

-   cleanup;
-   optimization non-material;
-   formatting;
-   minor diagnostic improvement;
-   dead/unused structure yang tidak memengaruhi hasil.

**Tindakan:** dapat dijadwalkan setelah correctness selesai.

------------------------------------------------------------------------

# 4. STAGE 5A --- BASELINE FREEZE

## 4.1 Baseline Source

Source baseline:

`script-terbaru.zip`

SHA-256:

`ab6b76eae23d0912630889d88f69d1210e81d956368943abff068b46729bb855`

Inventory:

-   17 JavaScript source files
-   10 test files
-   16 documentation files
-   11 phase result JSON files
-   1 scan-context
-   Config
-   Wallet database
-   README
-   package-lock
-   package.json

Phase 11 source SHA-256:

`8489ee42903152384fd515b884b5a55d5f435c90c67482be067044b6c02d6063`

SHA tersebut sama dengan Phase 11 baseline yang telah dikunci pada Tahap
1--4J.

## 4.2 Syntax Gate

Semua `Script/*.js` dan `main.js`:

**PASS**

Tidak ditemukan syntax error pada baseline.

## 4.3 Full Scan Baseline

CA:

`8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`

Phase status:

  Phase      Status
  ---------- ----------
  Phase 1    COMPLETE
  Phase 2    COMPLETE
  Phase 3    COMPLETE
  Phase 4    PARTIAL
  Phase 5    PARTIAL
  Phase 6    SAMPLED
  Phase 7    PARTIAL
  Phase 8    PARTIAL
  Phase 9    COMPLETE
  Phase 10   COMPLETE
  Phase 11   COMPLETE

Run ID dan mint konsisten di seluruh Phase 1--11.

## 4.4 Phase 11 Arithmetic Baseline

Dari output baseline:

-   weighted sum = `4885`
-   available weight = `90`
-   raw = `54.2777...`
-   final score = `54`

**PASS**

Output score konsisten dengan `score_breakdown`.

------------------------------------------------------------------------

# 5. STAGE 5B --- AUTOMATED REGRESSION

Command:

`npm test`

Hasil baseline:

  Metric      Result
  --------- --------
  Total           54
  PASS            52
  FAIL             2
  Skipped          0

## 5.1 Finding --- Phase 11 Test Fixture

Test:

`Phase 11 exposes coverage as context without turning it into a scoring dimension`

Expected fixture:

`74`

Actual:

`56`

Test pertama dalam file yang sama tetap PASS, yaitu perubahan coverage
tidak mengubah score.

Phase 11 source SHA tetap sama dengan baseline terkunci.

### Classification

**P2 --- TEST BASELINE DRIFT / OUTDATED EXPECTATION**

Tidak ada bukti bahwa formula Phase 11 rusak.

Nilai `74` tidak ditemukan sebagai baseline resmi. Dokumentasi lama
mencatat 57/100 pada checkpoint berbeda, sedangkan full scan baseline
saat ini menghasilkan 54/100.

### Decision

-   Jangan mengubah formula Phase 11.
-   Jangan mengubah source Phase 11 hanya untuk membuat test pass.
-   Reconcile fixture dengan baseline resmi.
-   Setelah fixture direkonsiliasi, jalankan regression ulang.

------------------------------------------------------------------------

# 6. STAGE 5B --- PHASE 5 COVERAGE TEST DRIFT

Test:

`Phase 5 page cap is PARTIAL with explicit has_more_possible`

Implementasi aktual:

-   status = PARTIAL
-   reason = PAGE_LIMIT
-   has_more_possible = true
-   scope = CONFIGURED_PAGE_WINDOW

Test mengharapkan:

`FULL_AVAILABLE_DATA`

### Classification

**P2 --- TEST CONTRACT DRIFT / OUTDATED EXPECTATION**

Implementasi sesuai dengan bounded retrieval semantics yang telah
dikunci dalam Universal Coverage Contract dan Tahap 4E.

### Decision

Test harus direkonsiliasi.

Source tidak diubah untuk mengikuti expectation test yang bertentangan
dengan contract.

------------------------------------------------------------------------

# 7. SECURITY FINDING

`Config/config.json` pada baseline source mengandung `helius.api_key`
yang terisi dan bukan placeholder.

Nilai secret tidak dicantumkan dalam dokumen.

### Classification

**P1 --- HIGH**

Masalah ini bertentangan dengan security baseline proyek yang menetapkan
API key tidak disimpan di source/config yang dibagikan.

### Recommended remediation

-   gunakan environment variable atau external secret mechanism;
-   config source hanya berisi placeholder/non-secret configuration;
-   regression ZIP berikutnya wajib diperiksa agar tidak mengandung
    secret.

**Status:** FINDING --- BELUM DIPATCH pada checkpoint ini.

------------------------------------------------------------------------

# 8. STAGE 5C --- SEVEN-CA REGRESSION

Pada baseline checkpoint ini, source hanya membundel output lengkap
untuk satu CA:

`8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`

Seven-CA regression belum dapat dianggap selesai tanpa dataset 7 CA yang
sama.

### Status

**BLOCKED / WAITING FOR 7-CA REGRESSION DATASETS**

Tidak boleh membuat atau mengasumsikan dataset pengganti.

Regression 7 CA wajib menggunakan:

-   CA yang sama;
-   konfigurasi yang sama;
-   parameter scan yang sama;
-   source patch yang diketahui;
-   comparison terhadap output baseline lama.

------------------------------------------------------------------------

# 9. STAGE 5 --- PRIORITY FINDING REGISTER

Semua temuan berikut dikumpulkan sebelum patch.

## P0

**Tidak ada P0 yang terkonfirmasi pada audit saat ini.**

## P1

  -------------------------------------------------------------------------------------------
  ID                      Finding                                     Status
  ----------------------- ------------------------------------------- -----------------------
  SEC-01                  API key tersimpan di config                 CONFIRMED

  PH6-07                  `rpc()` → parser contract mismatch pada     CONFIRMED
                          `getAccountInfo`                            

  PH6-08                  PumpSwap Pool parser terkena mismatch yang  CONFIRMED
                          sama                                        

  PH6-09                  Global change terhadap `rpc()` berisiko     CONFIRMED
                          mematahkan consumer lain                    

  PH6-10                  `getTokenAccountBalance()` bergantung pada  CONFIRMED
                          current RPC return shape                    

  PH6-16                  Tidak ada test yang mengunci                CONFIRMED
                          `getAccountInfo` response contract          

  PH6-17                  PoolState failure silently discarded        CONFIRMED

  PH6-21                  Tidak ada regression test khusus            CONFIRMED
                          `getAccountInfo → result.value`             

  PH6-26                  GlobalConfig failure lebih kritis terhadap  CONFIRMED
                          fee model completeness                      

  PH6-31                  `fee_flow_verification.component_results`   CONFIRMED
                          ditulis lalu ditimpa                        

  PH6-33                  `fee_destinations` kosong/dead tetapi       CONFIRMED
                          dikonsumsi Phase 7/8                        

  PH6-36                  Absent creator-fee field diperlakukan       CONFIRMED
                          sebagai verified zero                       

  PH6-37                  GlobalConfig discriminator tidak divalidasi CONFIRMED

  PH6-40                  Positive balance delta tidak cukup untuk    CONFIRMED
                          membuktikan fee attribution                 

  PH6-41                  PumpSwap execution/instruction evidence     CONFIRMED
                          perlu menjadi gate yang lebih kuat untuk    
                          VERIFIED routing                            

  PH6-43                  Phase 11 menganggap Phase 6 score 0 sebagai CONFIRMED
                          available                                   

  PH6-44                  Phase 11 fee utility tidak membedakan       CONFIRMED
                          VERIFIED vs UNKNOWN melalui                 
                          `project_utility_verified`                  

  PH6-46                  Attribution weakness dapat menjadi input    CONFIRMED
                          Phase 11                                    
  -------------------------------------------------------------------------------------------

## P2

  --------------------------------------------------------------------------------
  ID                      Finding                          Status
  ----------------------- -------------------------------- -----------------------
  TEST-01                 Phase 11 test fixture drift      CONFIRMED

  TEST-02                 Phase 5 coverage scope test      CONFIRMED
                          drift                            

  PH6-02                  Error diagnostic terlalu generic CONFIRMED

  PH6-03                  Raw RPC response tidak           CONFIRMED
                          dipertahankan untuk diagnosis    

  PH6-18                  GlobalConfig failure punya       CONFIRMED
                          diagnostic, PoolState failure    
                          tidak                            

  PH6-20                  `protocol_state.status` dapat    OPEN
                          tertinggal UNKNOWN               

  PH6-22                  `fee_destinations` dead field    SUPERSEDED BY PH6-33

  PH6-23                  GlobalConfig fetched berulang    CONFIRMED
                          per PumpSwap pool                

  PH6-24                  `protocol_state.programs` /      CONFIRMED
                          `global_configs` dapat duplicate 

  PH6-30                  `fee_flow_verification.status`   OPEN / CONTRACT REVIEW
                          PARTIAL saat komponen VERIFIED   

  PH6-32                  `protocol_state.status` tidak    OPEN
                          difinalisasi                     

  PH6-35                  Duplicate program state          CONFIRMED

  PH6-38                  PoolState parser tidak defensive CONFIRMED
                          validate owner/discriminator     

  PH6-39                  Coverage semantics SAMPLED vs    OPEN
                          EMPTY perlu diperjelas           

  PH6-42                  Transfer evidence dapat          CONFIRMED
                          duplicate                        

  PH6-45                  `fee_utility=1/100` dapat        CONFIRMED
                          terlihat seperti negative        
                          economic score saat evidence     
                          UNKNOWN                          

  PH6-47                  Fee utility provenance belum     CONFIRMED
                          sepenuhnya eksplisit             
  --------------------------------------------------------------------------------

------------------------------------------------------------------------

# 10. PHASE 6 DEEP AUDIT

## 10.1 Baseline Source

Latest audited source ZIP:

`STI-new-patch-LP-risk-fix.zip`

SHA-256:

`a69422b441bb404179f3e54c353d00f134cc46b38399bc1c8055a94fcb2db0b6`

File utama yang diaudit:

`Script/phase6_fee_trading_economics.js`

------------------------------------------------------------------------

# 11. PH6-07 --- RPC → PARSER CONTRACT MISMATCH

### Priority

**P1 --- HIGH**

### Observed implementation

`rpc()` mengembalikan:

`out.result`

Untuk `getAccountInfo`, struktur yang diterima caller menjadi:

``` text
result
└── value
    └── data
```

Sedangkan `readAccountBytes(account)` mengharapkan:

``` text
account
└── data
```

Akibatnya parser menerima object pada level yang salah.

### Impact

GlobalConfig dan PoolState dapat gagal diparse walaupun account
sebenarnya tersedia.

### Root cause

Mismatch kontrak antar-layer:

``` text
RPC wrapper contract
        ≠
getAccountInfo consumer contract
```

### Recommended solution

Jangan mengubah `rpc()` global.

Gunakan normalizer/contract khusus untuk `getAccountInfo`:

``` text
getAccountInfo
→ result.value
→ normalize account object
→ parser
```

Alasan: consumer lain seperti `getTokenAccountBalance()` bergantung pada
current `r?.value` shape.

------------------------------------------------------------------------

# 12. PH6-08 / PH6-14 --- POOLSTATE TERKENA MISMATCH

### Priority

**P1 --- HIGH**

`parsePumpSwapPool()` juga gagal jika menerima object pada level
`result` bukannya `result.value`.

Ini bukan bug layout decoder.

Root cause tetap contract mismatch PH6-07.

------------------------------------------------------------------------

# 13. PH6-16 / PH6-21 --- RPC CONTRACT TIDAK DIKUNCI TEST

### Priority

**P1 --- HIGH**

Belum ada test yang secara eksplisit mengunci:

``` text
getAccountInfo
→ result
→ value
→ account data
→ parser
```

### Recommended test cases

1.  valid `result.value.data`;
2.  `result.value = null`;
3.  malformed account data;
4.  parser tidak boleh salah menganggap `result` sebagai account.

------------------------------------------------------------------------

# 14. PH6-37 --- GLOBALCONFIG DISCRIMINATOR TIDAK DIVALIDASI

### Priority

**P1 --- HIGH**

Parser saat ini terutama memvalidasi minimum length.

Minimum length saja tidak cukup untuk memastikan account adalah
GlobalConfig.

### Recommended validation

``` text
owner
+
discriminator
+
minimum layout
+
field boundaries
→ parse
```

Jika discriminator salah:

`PARSE_FAILED / INVALID_DISCRIMINATOR`

------------------------------------------------------------------------

# 15. PH6-38 --- POOLSTATE DEFENSIVE VALIDATION

### Priority

**P2 --- MEDIUM**

Phase 4 sudah melakukan owner/discriminator validation.

Namun parser Phase 6 sendiri belum melakukan defensive validation yang
sama.

Recommended:

``` text
owner == PumpSwap
+
PoolState discriminator
+
layout valid
→ parse
```

------------------------------------------------------------------------

# 16. PH6-36 --- ABSENT FIELD ≠ VERIFIED ZERO

### Priority

**P1 --- HIGH**

Current behavior dapat melakukan:

``` text
field absent
→ bps = 0
→ VERIFIED
```

Ini semantic error.

Harus dibedakan:

  Kondisi                 Status
  ----------------------- -----------------------------
  Field ada, value \> 0   VERIFIED
  Field ada, value = 0    VERIFIED
  Field absent            UNKNOWN / INSUFFICIENT_DATA
  Parse gagal             UNKNOWN / INSUFFICIENT_DATA
  Conflict                CONFLICT

Tidak boleh mengubah absence menjadi factual zero.

------------------------------------------------------------------------

# 17. PH6-31 --- COMPONENT RESULTS DITIMPA

### Priority

**P1 --- HIGH**

Transaction verification menulis detailed evidence ke:

`fee_flow_verification.component_results`

Kemudian finalization mengganti field tersebut dengan summary hasil
`fee_components`.

Akibatnya detailed `poolEvidence` hilang dari field tersebut.

### Recommended structure

Pisahkan:

``` text
fee_flow_verification
├── status
├── summary
└── component_results

fee_flow_evidence
├── pool
├── transactions_sampled
├── transfers
├── signatures
└── attribution
```

Summary tidak boleh menghancurkan evidence.

------------------------------------------------------------------------

# 18. PH6-33 --- `fee_destinations` TIDAK TERISI

### Priority

**P1 --- HIGH**

Phase 7 dan Phase 8 membaca:

`phase6.fee_destinations.components`

Tetapi Phase 6 lebih banyak menyimpan destination pada:

`fee_components[].destination`

Akibatnya explicit downstream contract menjadi tidak konsisten.

### Recommended solution

Tetapkan `fee_components` sebagai canonical source, lalu bangun:

``` text
fee_components
→ destination registry
→ deduplicate
→ fee_destinations
```

`fee_destinations` tidak boleh dihitung dengan logic kedua yang dapat
menghasilkan daftar berbeda.

------------------------------------------------------------------------

# 19. PH6-40 / PH6-41 --- FEE ATTRIBUTION

### Priority

**P1 --- HIGH**

Positive balance delta pada recipient tidak otomatis membuktikan bahwa
transfer tersebut adalah fee.

### Evidence hierarchy yang disarankan

#### Strong

PumpSwap execution/instruction + recipient + matching amount/transfer.

→ `VERIFIED`

#### Moderate

Known PumpSwap transaction + matching transfer + known recipient, tetapi
instruction attribution tidak lengkap.

→ `OBSERVED` / `PARTIAL`

#### Weak

Hanya recipient balance increase.

→ `OBSERVED` atau `INSUFFICIENT_DATA`

Tujuan perubahan bukan menghapus evidence, tetapi memperbaiki kekuatan
klaim.

------------------------------------------------------------------------

# 20. PH6-42 --- TRANSFER EVIDENCE DEDUPLICATION

### Priority

**P2 --- MEDIUM**

Evidence transfer harus memiliki identity yang stabil, misalnya
kombinasi:

``` text
signature
+
recipient
+
amount
+
source
```

Pipeline:

``` text
raw transfers
→ evidence identity
→ deduplicate
→ evaluated observations
```

------------------------------------------------------------------------

# 21. PH6-39 / PH6-30 / PH6-32 --- STATUS SEMANTICS

### Priority

**P2 --- MEDIUM**

Status harus membedakan:

-   COMPLETE
-   PARTIAL
-   SAMPLED
-   EMPTY
-   UNKNOWN
-   FAILED

Sampling tidak boleh berubah menjadi COMPLETE.

`protocol_state.status` juga harus difinalisasi sehingga tidak
tertinggal `UNKNOWN` ketika state sebenarnya sudah tersedia.

`fee_flow_verification.status = PARTIAL` saat hanya sebagian evidence
terverifikasi perlu ditinjau terhadap contract sebelum patch.

------------------------------------------------------------------------

# 22. PH6-43 / PH6-44 --- PHASE 11 INPUT ELIGIBILITY

### Priority

**P1 --- HIGH**

Phase 6 dapat menghasilkan:

``` text
score = 0
```

dengan:

``` text
project_utility_verified = false
```

Phase 11 saat ini dapat memperlakukan score 0 tersebut sebagai available
dimension.

Masalahnya bukan formula Phase 11.

Masalahnya adalah **eligibility dan semantic interpretation input**.

### Required distinction

``` text
VERIFIED + score 0
→ available

UNKNOWN + score 0
→ not available

INSUFFICIENT_DATA
→ not available
```

`project_utility_verified` harus tetap menjadi single source of truth.

**Phase 11 formula tidak diubah.**

------------------------------------------------------------------------

# 23. PH6-45 --- SCORE 1/100 DAPAT MENYESATKAN

### Priority

**P2 --- MEDIUM**

Jika UNKNOWN diubah menjadi angka minimum seperti `1/100`, report dapat
membuatnya terlihat seperti negative economic assessment.

Recommended presentation:

``` text
Economic Utility: UNKNOWN
Score contribution: NOT AVAILABLE
```

bukan angka semu jika evidence belum cukup.

------------------------------------------------------------------------

# 24. PH6-47 --- FEE UTILITY PROVENANCE

### Priority

**P2 --- MEDIUM**

Target lineage:

``` text
Phase 11
→ fee_utility
→ Phase 6 assessment
→ fee component
→ transaction evidence
→ signature
```

Setiap skor harus dapat ditelusuri kembali ke evidence yang
mendasarinya.

------------------------------------------------------------------------

# 25. PH6-23 / PH6-24 / PH6-34 / PH6-35 --- CACHE DAN DEDUP

### Priority

**P2 --- MEDIUM**

GlobalConfig adalah account yang sama untuk venue/program yang sama.

Saat ini dapat diminta berulang untuk setiap pool.

Recommended:

``` text
programId + globalConfigAddress
→ cache
```

Selain itu:

-   deduplicate `protocol_state.programs`;
-   deduplicate `global_configs`.

Optimasi ini dilakukan setelah correctness selesai.

------------------------------------------------------------------------

# 26. TEMUAN YANG DIKONFIRMASI BAIK / TIDAK PERLU DIPATCH

Audit juga menemukan beberapa behavior yang benar.

## 26.1 Transaction fallback

Transaction evidence tetap dapat menghasilkan evidence walaupun
GlobalConfig gagal.

**Status: GOOD**

## 26.2 Routing ≠ Economic Utility

`routing_verified = true` tetapi:

`project_utility_verified = false`

dan:

`score = 0`

adalah behavior yang benar.

**Status: GOOD**

## 26.3 Downstream Ownership

Recipient dapat ditemukan tetapi ownership tetap:

`UNKNOWN`

**Status: GOOD**

## 26.4 Creator identity fallback

Jika PoolState gagal, Phase 4 `pool.coin_creator` masih dapat
menyediakan creator identity.

**Status: GOOD**

## 26.5 Coverage limitations

Sampling dan bounded retrieval tidak boleh dianggap full history.

**Status: GOOD**

------------------------------------------------------------------------

# 27. PUMPSWAP V7 --- TEMUAN TERKAIT YANG SUDAH DISELESAIKAN

Dalam audit PumpSwap V2--V7 ditemukan masalah discovery/decoder yang
telah diperbaiki sebelum audit Phase 6 lanjutan.

CA:

`8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`

Pool terkonfirmasi:

`CbR2UL7ktBr8MUUTj3FYcURZerp28GA2p1vPuMeKy1Je`

Properties:

-   owner = PumpSwap
-   base mint = CA
-   quote = WSOL
-   data length = 301
-   discriminator = `f19a6d0411b16dbc`
-   layout = `MODERN_301_OR_EXTENDED`
-   status = `CONFIRMED_TARGET_POOL`
-   confidence = `HIGH`

Global discovery tetap:

`PARTIAL / PAGE_LIMIT / CONFIGURED_PAGE_WINDOW / has_more_possible=true`

Direct owner probe:

`COMPLETE` dalam scope candidate-owner tersebut.

Kesimpulan:

> Direct probe complete tidak berarti seluruh PumpSwap network discovery
> complete.

Pool `CbR2...` diklasifikasikan:

`LIQUIDITY_POOL`

dan tidak boleh diperlakukan sebagai normal holder.

------------------------------------------------------------------------

# 28. CROSS-PHASE SEMANTIC FINDING --- LIQUIDITY POOL VS WALLET RISK

Temuan ini berasal dari audit sebelum Phase 6 remediation dan harus
tetap tercatat sebagai bagian Stage 5 regression history.

### Masalah

Phase 4:

`CbR2... = LIQUIDITY_POOL`

Phase 8:

pool masuk sebagai history subject.

Phase 9:

SELL activity pool dapat diproses sebagai wallet SELL pressure.

Phase 10:

risk dapat masuk sebagai `SELL_PRESSURE_RISK`.

Phase 11:

risk tersebut dapat memengaruhi score.

### Root cause

Phase 9 sebelumnya hanya menerima Phase 8 dan tidak memiliki entity
classification Phase 4.

### Remediation yang sudah dilakukan

Phase 9 sekarang menerima Phase 4 classification dan mengecualikan
hanya:

`LIQUIDITY_POOL`

dari wallet-level `SPR-02`.

Tidak mengubah:

-   SPR-02 threshold;
-   risk weight;
-   Phase 10 BA;
-   evidence identity;
-   Phase 11 formula;
-   coverage.

### Validation

Setelah patch:

-   `CbR2...` tidak lagi memicu SPR-02;
-   normal wallet lain tetap dapat memicu SPR-02;
-   Phase 10 tetap memiliki valid risk dari normal wallet;
-   Phase 11 tetap menghasilkan 54 pada kasus baseline karena risk 75
    dari normal wallet masih valid.

### Classification

**P1 --- HIGH**

Status:

**PATCHED AND VALIDATED ON TARGET CASE**

Wajib masuk ke 7-CA regression untuk memastikan behavior konsisten.

------------------------------------------------------------------------

# 29. RECOMMENDED REMEDIATION ORDER

Patch belum dilakukan pada checkpoint dokumentasi ini.

Urutan yang disepakati:

1.  PH6-07 / PH6-08 / PH6-14 --- controlled `getAccountInfo`
    normalization.
2.  PH6-16 / PH6-21 --- lock RPC contract with tests.
3.  PH6-37 --- GlobalConfig discriminator validation.
4.  PH6-38 --- PoolState owner/discriminator validation.
5.  PH6-36 --- absent creator-fee field → UNKNOWN/INSUFFICIENT_DATA.
6.  PH6-31 --- separate summary from detailed evidence.
7.  PH6-33 --- canonical `fee_destinations`.
8.  PH6-40 / PH6-41 --- stronger fee attribution.
9.  PH6-42 --- transfer evidence deduplication.
10. PH6-39 / PH6-30 / PH6-32 --- coverage/status semantic cleanup.
11. PH6-43 / PH6-44 --- Phase 11 input eligibility.
12. PH6-45 / PH6-47 --- presentation/provenance.
13. PH6-23 / PH6-24 / PH6-34 / PH6-35 --- cache/dedup optimization.
14. Focused regression.
15. Full 54-test regression.
16. Seven-CA regression.
17. Cross-phase output validation.
18. HTML/report validation.
19. Final Stage 5 gate.

------------------------------------------------------------------------

# 30. PATCHING RULES

Sebelum patch:

-   source baseline harus di-hash;
-   finding dan root cause harus sudah tercatat;
-   locked contract tidak boleh diubah tanpa keputusan eksplisit.

Setiap patch:

1.  Minimal change.
2.  Tidak mengubah scoring arbitrarily.
3.  Tidak mengubah Phase 11 formula.
4.  Tidak mengubah evidence taxonomy.
5.  Tidak mengubah coverage taxonomy tanpa explicit decision.
6.  `node --check` pada source yang berubah.
7.  Focused test.
8.  Full regression.
9.  Regression terhadap 7 CA.
10. Compare before/after.
11. Inspect downstream effects.
12. ZIP integrity.
13. SHA-256 final package.
14. Document residual risks.

------------------------------------------------------------------------

# 31. REGRESSION CHECKLIST SETELAH PATCH

## A. Parser / RPC

-   [ ] getAccountInfo valid account
-   [ ] getAccountInfo null
-   [ ] malformed data
-   [ ] GlobalConfig discriminator
-   [ ] PoolState discriminator
-   [ ] PoolState owner
-   [ ] modern/extended layout

## B. Evidence

-   [ ] absent field does not become verified zero
-   [ ] transaction evidence retained
-   [ ] evidence not overwritten
-   [ ] transfer deduplication
-   [ ] attribution strength correct

## C. Coverage

-   [ ] requested \>= observed \>= retained
-   [ ] SAMPLED remains SAMPLED
-   [ ] PARTIAL remains PARTIAL
-   [ ] EMPTY only when scope supports EMPTY
-   [ ] UNKNOWN remains UNKNOWN when evidence insufficient

## D. Downstream

-   [ ] fee_destinations populated
-   [ ] Phase 7 consumes canonical destination
-   [ ] Phase 8 consumes canonical destination
-   [ ] Phase 9 entity classification preserved
-   [ ] Phase 10 does not score insufficient evidence
-   [ ] Phase 11 respects input eligibility

## E. Scoring

-   [ ] Phase 11 formula unchanged
-   [ ] locked weights unchanged
-   [ ] score changes only because valid upstream input changed
-   [ ] no score change caused solely by coverage status
-   [ ] unknown does not become negative

## F. Security

-   [ ] no API key in config
-   [ ] no secret in ZIP
-   [ ] placeholder configuration only

------------------------------------------------------------------------

# 32. CURRENT STAGE 5 GATE

## PASS

-   source extraction
-   source inventory
-   syntax check
-   Phase 11 locked SHA
-   full-scan run/mint consistency
-   Phase 11 output arithmetic
-   coverage record invariant
-   Phase 8/9/10 coverage semantics
-   PumpSwap V7 target-pool validation
-   Phase 9 LP entity eligibility patch validation on target case

## FINDINGS --- HISTORICAL / RECONCILED

The findings below are retained as audit history. Items already remediated are
not reopened merely because their original finding text remains in earlier
sections.

-   TEST-01 Phase 11 expectation drift — **RECONCILED in Batch 4**
-   TEST-02 Phase 5 coverage contract drift — **RECONCILED in Batch 4**
-   Phase 6 RPC/parser contract — **REMEDIATED + REGRESSION PASS**
-   Phase 6 parser validation — **REMEDIATED + REGRESSION PASS**
-   evidence overwrite / fee attribution strength — **REMEDIATED + REGRESSION PASS**
-   fee destination contract — **REMEDIATED + REGRESSION PASS**
-   Phase 11 fee utility eligibility — **REMEDIATED + REGRESSION PASS**
-   provenance/status issues — **REMEDIATED + REGRESSION PASS**
-   protocol-state cache/dedup findings — **REMEDIATED + REGRESSION PASS**
-   baseline security secret finding — **OPEN; final security closure still pending**

## NOT YET COMPLETE

-   seven-CA regression after all latest patches
-   cross-CA score stability
-   cross-CA evidence lineage
-   cross-CA coverage-to-score
-   final HTML/report audit across 7 CA
-   final post-remediation full regression against the official 54-test baseline

------------------------------------------------------------------------

# 33. CURRENT STAGE 5 STATUS

**Stage 5A --- Baseline Freeze: PASS**

**Stage 5B --- Automated Regression: Batch 4 package tests 30/30 PASS**

The original baseline remains recorded as 52/54 PASS with two test-contract
findings. Batch 4 reconciles those contracts and makes the regression package
self-contained; the official 54-test baseline still requires a separate final
re-run before Stage 5B is declared fully closed.

**Stage 5C --- Seven-CA Regression: NOT COMPLETE**

**Phase 6 Deep Audit: COMPLETE**

**Phase 6 Remediation Design: COMPLETE**

**Phase 6 Remediation Implementation: IN PROGRESS — PH6-07 COMPLETED**

**Phase 9 LP entity-eligibility remediation: PATCHED AND
TARGET-VALIDATED**

------------------------------------------------------------------------

# 34. IMPORTANT DECISION LOCKS BEFORE PATCH

1.  Phase 11 formula remains unchanged.
2.  Phase 10 scoring rules remain unchanged unless a separate explicit
    scoring decision is made.
3.  `project_utility_verified` remains the single source of truth.
4.  Routing verification does not equal economic utility verification.
5.  Missing data is not negative evidence.
6.  Absent field is not factual zero.
7.  Positive balance delta is not automatically fee proof.
8.  `LIQUIDITY_POOL` is not a normal wallet for wallet-level sell-risk
    evaluation.
9.  `SAMPLED` is not `COMPLETE`.
10. Global discovery completeness must not be inferred from a complete
    direct probe.
11. Detailed evidence must not be destroyed when generating summary
    output.
12. Canonical evidence sources must be defined before downstream
    consumption.
13. Global RPC contract must not be changed blindly.
14. Every patch must be followed by regression.

------------------------------------------------------------------------

# 35A. REMEDIATION LOG — PH6-07

**Status:** PATCHED AND FOCUSED-VALIDATED

### Change

Added a local `normalizeGetAccountInfoResult()` helper that unwraps `rpc()` output from:

```text
rpc() result
└── value
    └── account
```

The normalized account object is now passed to:

- `parsePumpSwapPool()`
- `parsePumpSwapGlobal()`

The shared `rpc()` function was deliberately left unchanged.

### Files changed

- `Script/phase6_fee_trading_economics.js`
- `tests/phase6_get_account_info_contract.test.js`

### Validation

- `node --check Script/phase6_fee_trading_economics.js` → PASS
- focused tests → 6/6 PASS
- full `npm test` for this source ZIP → 6/6 PASS
- ZIP integrity → PASS

The source ZIP used for this remediation contains only the Phase 9 regression test plus the newly added Phase 6 contract test; therefore the 6/6 result must not be interpreted as the historical 54-test Stage 5 baseline.

### Scope protection

No change was made to:

- global `rpc()` return contract;
- Phase 10 scoring;
- Phase 11 formula;
- evidence taxonomy;
- coverage taxonomy.

### Residual validation

A real-network Phase 6 scan using the patched package is still required to confirm that GlobalConfig and PoolState now parse from actual `getAccountInfo` responses.

# 35. NEXT ACTION

The next implementation gate is:

**REMEDIATION PH6-07 --- CONTROLLED `getAccountInfo` NORMALIZATION**

Followed by the focused parser tests before moving to the next finding.

No additional scoring redesign is required at this point.

------------------------------------------------------------------------

------------------------------------------------------------------------

# 35B. REMEDIATION LOG — PH6-07 REAL-NETWORK VALIDATION

**Status:** VERIFIED ON REAL SCAN

The user executed the PH6-07 patch against the baseline CA:
`8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`.

Observed result:

- PumpSwap GlobalConfig: `FOUND` / `PARSED`
- GlobalConfig data length: `949`
- layout: `V2_WITH_CREATOR_FEE`
- LP fee: `20 bps`
- protocol fee: `5 bps`
- coin creator fee: `5 bps`
- PumpSwap PoolState: parsed successfully
- PoolState data length: `301`
- base mint matched the target CA
- quote mint: WSOL

This confirms the PH6-07 normalization fix works against a real network response and validates PH6-08 / PH6-14 at the functional parser level.

Source evidence: `phase6-result.json`, generated 2026-10-05.

------------------------------------------------------------------------

# 35C. REMEDIATION LOG — PH6-37 / PH6-38 / PH6-36 / PH6-31 / PH6-33

**Status:** PATCH IMPLEMENTED — REAL-NETWORK VALIDATION PENDING

The next remediation batch was implemented without changing Phase 10 or Phase 11 scoring.

### PH6-37 — GlobalConfig discriminator / owner validation

Added validation for the PumpSwap `GlobalConfig` Anchor discriminator:
`95089ccaa0fcb0d9`.

The parser now rejects:

- wrong discriminator;
- wrong account owner;
- insufficient account data.

The discriminator is aligned with the official PumpSwap IDL.

### PH6-38 — PoolState owner / discriminator validation

Added validation for:

- PumpSwap program owner;
- Pool account discriminator `f19a6d0411b16dbc`.

The parser now returns an explicit parse-failure reason instead of silently decoding arbitrary data with a matching length.

### PH6-36 — Absent creator-fee field

The legacy 313-byte GlobalConfig layout no longer converts an absent creator-fee field into factual zero.

New semantics:

```text
coin_creator_fee_basis_points = null
coin_creator_fee_basis_points_source = FIELD_ABSENT_UNKNOWN
```

The resulting `COIN_CREATOR_FEE` component becomes `UNKNOWN` rather than `VERIFIED ZERO`.

A present on-chain field remains authoritative and is parsed normally.

### PH6-31 — Detailed evidence lineage preservation

`fee_flow_verification.component_results` is no longer overwritten by a compact summary at finalization.

The detailed transaction evidence remains in `component_results`.
A separate `component_summaries` field is used for the final compact representation.

### PH6-33 — Canonical `fee_destinations`

`fee_destinations` is now materialized from the canonical `fee_components` destination data after fee-component construction.

This gives Phase 7/8 a consistent explicit destination source while retaining `fee_components` as the underlying evidence source.

### PH6-32 — Protocol state finalization

The same remediation pass also finalizes `protocol_state.status`:

- `FOUND` when parsed GlobalConfig exists without parse failures;
- `PARTIAL` when a parsed GlobalConfig coexists with a parse failure;
- `FAILED` when GlobalConfig retrieval/parsing fails without a parsed state;
- `UNKNOWN` when no meaningful GlobalConfig result exists.

### Focused validation

- `node --check Script/phase6_fee_trading_economics.js` → PASS
- PH6-07 contract tests → 4/4 PASS
- PH6 parser integrity tests → PASS
- Phase 9 liquidity-pool regression tests → 2/2 PASS
- full `npm test` on the current patch workspace → **7/7 PASS**

### Important boundary

The 7/7 result is focused validation of the current patch workspace. It is **not** a replacement for the historical Stage 5 54-test baseline and does not close Stage 5C.

The next required validation is a real-network Phase 6 scan using this new patch. Only after that result is reviewed will the findings be marked fully closed.

------------------------------------------------------------------------

# 35D. CURRENT PHASE 6 GATE

### Closed / verified

- PH6-07 — RPC response normalization: **VERIFIED ON REAL SCAN**
- PH6-08 — PoolState affected by response-shape mismatch: **VERIFIED FIXED**
- PH6-14 — PoolState parser now receives account state: **VERIFIED FIXED**

### Implemented, awaiting real-scan validation

- PH6-37 — GlobalConfig discriminator/owner validation
- PH6-38 — PoolState discriminator/owner validation
- PH6-36 — absent creator-fee field semantics
- PH6-31 — evidence lineage preservation
- PH6-33 — canonical fee destinations
- PH6-32 — protocol state status finalization

### Still open after this batch

- PH6-40 / PH6-41 — fee attribution strength and execution/instruction evidence gate
- PH6-42 — duplicate transfer evidence
- PH6-30 — `fee_flow_verification.status` semantics
- PH6-39 — `SAMPLED` vs `EMPTY` coverage semantics
- PH6-43 / PH6-44 / PH6-45 — Phase 11 fee-utility eligibility and evidence semantics
- PH6-23 / PH6-24 / PH6-34 / PH6-35 — caching/deduplication of protocol state

### Next action

Run one real-network Phase 6 scan with the new remediation batch and inspect:

1. `protocol_state.status`
2. GlobalConfig discriminator / owner fields
3. PoolState discriminator / owner fields
4. `COIN_CREATOR_FEE` verification semantics
5. `fee_flow_verification.component_results`
6. `fee_flow_verification.component_summaries`
7. `fee_destinations`

Do not proceed to the 7-CA regression until this Phase 6 gate passes.

------------------------------------------------------------------------

# 35E. REMEDIATION LOG — PH6-40 / PH6-41 FEE ATTRIBUTION GATE

**Status:** PATCH IMPLEMENTED — LOCAL REGRESSION PASS — REAL-NETWORK VALIDATION PENDING

### Root cause

The previous implementation treated a positive balance delta to a configured/known fee recipient as sufficient to mark routing `VERIFIED`. A positive delta proves that the destination balance increased during the inspected transaction, but by itself does not prove that the increase was caused by the PumpSwap trade fee.

### Minimal remediation

The new attribution gate requires all of the following before a transfer observation can become `VERIFIED` routing:

1. PumpSwap program is present in the transaction;
2. a PumpSwap trade instruction is identified (buy/sell family);
3. the candidate fee destination appears in that PumpSwap trade instruction's account list;
4. the same transaction contains a positive balance delta to that destination.

Positive balance evidence without the execution/instruction association remains `OBSERVED`, not `VERIFIED`.

The gate recognizes the PumpSwap buy/sell instruction discriminator families used by the current implementation. This is consistent with PumpSwap documentation that protocol fees are charged on `buy` / `sell` instructions and that protocol fee recipients participate in those instructions.

### Evidence lineage

Each observed fee transfer now carries `attribution_evidence` containing:

- `program_seen`;
- `trade_instruction_seen`;
- `recipient_in_trade_instruction`;
- `positive_balance_delta`;
- `verified`;
- explicit failure reason when the gate is not satisfied.

### Scope protection

No changes were made to:

- Phase 10 scoring;
- Phase 11 formula;
- evidence taxonomy;
- coverage taxonomy;
- fee bps configuration;
- economic utility verification rules.

### Local regression

`npm test` result after PH6-40/41 patch:

- Tests: **8**
- PASS: **8**
- FAIL: **0**

New regression test explicitly confirms that a positive balance delta alone cannot produce `VERIFIED`, while a PumpSwap trade instruction + recipient-account match + positive delta can.

### Real-network gate

One real-network Phase 6 scan is required before marking PH6-40/41 closed. Inspect especially:

- `fee_components[].verification` for `PROTOCOL_FEE`;
- `fee_components[].verification` for `COIN_CREATOR_FEE`;
- `observed_fee_transfers[].attribution_evidence`;
- `fee_flow_verification.component_results`;
- whether legitimate PumpSwap fee observations remain `VERIFIED` rather than being downgraded to `OBSERVED`.

Do not proceed to 7-CA regression until this real-network gate is validated.

Patch ZIP SHA-256:
`11c9057ece3cdce2f1d9822176f66b7b7c04758e6f9f8672cac1c8bae6b61d99`

------------------------------------------------------------------------


------------------------------------------------------------------------

# 35F. REMEDIATION LOG — PH6-42 EVIDENCE DEDUPLICATION

## Finding

Real-network Phase 6 scan after PH6-40/41 showed duplicate `PROTOCOL_FEE` evidence.

The same transaction transfer could enter `observed_fee_transfers` through two observation paths:

1. direct transaction balance matching;
2. `OFFICIAL_RECIPIENT_TX_TRACE` recipient discovery.

The observation source differed, but the underlying transfer identity was the same.

Example pattern:

- same signature;
- same asset;
- same recipient;
- same owner where applicable;
- same positive delta.

This caused duplicate evidence records and inflated `observed_transfer_count` / downstream ranking counts.

## Root Cause

The Phase 6 transaction loop appended observations directly into `c.observed_fee_transfers` without applying the locked evidence-identity/deduplication step before component aggregation.

The problem was therefore at the **evidence aggregation layer**, not scoring and not coverage.

## Patch

Added:

- `feeTransferIdentity()`
- `dedupeFeeTransfers()`

Identity fields:

- signature;
- asset;
- recipient;
- owner;
- native lamport delta when applicable;
- token raw delta when applicable;
- decimals.

Observation source is intentionally excluded from identity so that two retrieval paths describing the same transfer collapse into one evidence item.

Distinct transfers remain separate when recipient or amount differs.

Deduplication is applied to:

- `PROTOCOL_FEE.observed_fee_transfers`;
- `COIN_CREATOR_FEE.observed_fee_transfers`;
- per-transaction protocol evidence counts used by `fee_flow_verification.component_results`.

Downstream destination ranking therefore consumes the deduplicated component evidence rather than double-counted observations.

## Scope Protection

No changes were made to:

- Phase 10 scoring;
- Phase 11 formula;
- fee bps;
- coverage limits;
- attribution gate PH6-40/41;
- economic utility verification;
- evidence taxonomy.

The patch only enforces the existing evidence identity → deduplicate contract.

## Regression

Dedicated PH6-42 test:

- same transfer observed through two source paths → **1 evidence**;
- different recipient → remains distinct;
- different amount → remains distinct;
- native SOL duplicate → **1 evidence**.

Result:

`PASS phase6_fee_dedup`

PH6 focused regression after patch:

- PH6 fee attribution: PASS;
- PH6 evidence dedup: PASS;
- PH6 parser integrity: PASS;
- PH6 getAccountInfo contract: 4/4 PASS;
- JavaScript syntax check: PASS.

The broader local suite containing the historical Phase 9 liquidity-pool test produced one failure because the copied source baseline used for this isolated PH6 package does not contain the previously patched Phase 9 liquidity-pool exclusion. This is an unrelated baseline/package composition issue and was not changed as part of PH6-42.

## Real-Network Validation Required

Before closing PH6-42, run the same CA `8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq` again and verify:

1. duplicate `(signature, recipient, asset, amount)` transfers collapse to one;
2. `PROTOCOL_FEE.observed_transfer_count` decreases consistently with unique evidence;
3. `destination_evidence.observed_count` and `verified_count` are based on unique transfers;
4. legitimate `VERIFIED` attribution from PH6-40/41 remains `VERIFIED`;
5. downstream ranking uses deduplicated counts and amounts;
6. no change occurs to fee economics score or coverage semantics.

Do not proceed to 7-CA regression until this real-network gate is validated.

Patch ZIP SHA-256:
`ff9e1a2c37f4514b80aeb8d04ba2d6648a4ddcb7ec0b76a1e6b92400ff0a457e`

------------------------------------------------------------------------

## END OF DOCUMENT

## 35G. REMEDIATION LOG — PHASE 9 LIQUIDITY-POOL ENTITY EXCLUSION

**Date:** 2026-10-06

### Finding

The 5-CA regression using the PH6-42 source showed that Phase 9 SPR-02 could treat a confirmed PumpSwap `LIQUIDITY_POOL` account as a wallet-level repeated-sell actor. For CA `8DXq...`, pool `CbR2UL7ktBr8MUUTj3FYcURZerp28GA2p1vPuMeKy1Je` was incorrectly eligible for SPR-02 despite Phase 4 classifying it as `LIQUIDITY_POOL`.

### Root cause

Phase 9 previously consumed Phase 8 wallet events without consuming Phase 4 entity classification. Therefore SPR-02 grouped SELL events by wallet address without excluding confirmed liquidity-pool entities.

### Patch scope

- Phase 9 now consumes Phase 4 classification for entity filtering.
- Only confirmed `LIQUIDITY_POOL` classifications are excluded from wallet-level SPR-02.
- SPR-02 thresholds, 1-hour window, scoring, Phase 10 BA, Phase 11 formula, and evidence deduplication are unchanged.
- Normal wallet behavior remains eligible for SPR-02.

### Targeted regression

CA: `8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq`

Result:
- `CbR2...` no longer triggers SPR-02.
- Normal wallet `FfdZ1a...` still triggers SPR-02 with 9 unique SELL transactions in the configured 1-hour window.
- Phase 9 remains 18 rules: 2 TRIGGERED, 16 INSUFFICIENT_DATA.
- Phase 10 remains COMPLETE with 2 findings scored.
- Phase 11 final score remains **54/100**.
- Phase 11 integrity remains valid; targeted rerun produced only expected missing-run-metadata warnings because Phase 9/10 were executed directly in the regression workspace.

### Regression tests

Combined focused suite: **8/8 PASS**
- PH6-40/41 fee attribution
- PH6-42 fee evidence deduplication
- getAccountInfo contract
- Phase 6 parser integrity
- Phase 9 liquidity-pool exclusion

### Patch artifact

PH6-42 + Phase 9 entity-classification integration patch.


# 35H. REMEDIATION LOG — PH6-30 / PH6-39 / PH6-43 / PH6-44 / PH6-45 / PH6-47 / PH6-23 / PH6-24 / PH6-34 / PH6-35

Tanggal: 2026-10-06 (WIB)

## Scope

Remediation batch ini menyelesaikan seluruh finding Phase 6 yang tersisa pada checkpoint prioritas, tanpa mengubah formula scoring Phase 10 maupun formula weighted mean Phase 11.

### PH6-30 — Fee-flow status semantics

Added canonical aggregation for `fee_flow_verification.status`:

- all components `VERIFIED` → `VERIFIED`;
- any incomplete/observed/unknown component with verified evidence → `PARTIAL`;
- incomplete evidence without verified component → `PARTIAL`;
- no components → `UNKNOWN`.

Status agregat tidak dipakai sebagai negative score.

### PH6-39 — SAMPLED vs EMPTY

Added explicit Phase 6 coverage aggregation.

Rules:

- sampled retrieval remains `SAMPLED`, termasuk ketika observed record count = 0;
- explicit completed empty retrieval may be `EMPTY`;
- absence of a retrieval coverage record is `UNKNOWN`, bukan `EMPTY`;
- partial/failed retrieval is preserved as `PARTIAL`/`FAILED` according to the available dataset coverage.

This prevents a missing retrieval scope from becoming a false `NO_MATCH` claim.

### PH6-43 / PH6-44 — Phase 11 fee-utility eligibility

`project_utility_verified` tetap menjadi single source of truth.

- `project_utility_verified=true` + numeric source score → fee dimension eligible;
- `project_utility_verified=false` / unknown → fee dimension unavailable;
- unavailable fee utility is excluded from the Phase 11 denominator;
- Phase 11 weighted-mean formula is unchanged.

A verified source score of 0 remains an available dimension and is still represented within the existing Phase 11 1–100 dimension range.

### PH6-45 — UNKNOWN is not a negative numeric score

Phase 11 no longer converts an unverified fee-utility state into an apparent `1/100` contribution. The dimension now reports `score=null`, `available=false`, and explicit eligibility/status details.

### PH6-47 — Fee utility provenance

Phase 6 `fee_economic_assessment` now records provenance from:

`Phase 11 → fee_utility → Phase 6 fee_economics.score → fee components → verified transfer evidence → signatures`

The provenance includes component verification state, verified transfer counts, and verified transaction signatures.

### PH6-23 / PH6-34 — GlobalConfig cache

PumpSwap GlobalConfig is now cached by:

`programId + globalConfigAddress`

Only successful parsed state is cached within one scan run. Failed retrieval/parse is not cached so a later pool may retry.

### PH6-24 / PH6-35 — protocol-state deduplication

`protocol_state.programs` and `protocol_state.global_configs` are deduplicated using canonical identity. Distinct addresses/programs remain separate, and conflicting status observations remain separate.

## Validation

Focused regression at the Batch 1–3 package checkpoint:

- **23/24 PASS**
- The only failure was `phase9_liquidity_pool.test.js` because the ZIP did
  not contain the runtime `Output/<CA>/phase8-result.json` fixture.
- No Phase 9 logic failure was established by that missing-file error.

Batch 4 remediation:

- Phase 9 liquidity-pool regression is now self-contained under
  `tests/fixtures/phase9_liquidity_pool/`.
- TEST-01 and TEST-02 contract tests were added.
- Final Batch 4 package regression: **30/30 PASS**.

## Real-output downstream regression

Using the existing 8DXq scan output:

- historical Phase 11 result: **54/100**; fee utility dimension was `1`, available;
- patched Phase 11 result: **61/100**; fee utility dimension is unavailable because `project_utility_verified=false`;
- the score change is an expected denominator/eligibility effect, not a formula change.

## Validation boundary

A new real-network Phase 6 scan using this batch is still required before these findings are marked fully verified on-chain. In particular, the scan should confirm:

1. `fee_flow_verification.status`;
2. `coverage.status` for sampled zero-record and normal sampled cases;
3. `protocol_state.cache` hit/miss behavior across multiple PumpSwap pools;
4. deduplicated `protocol_state.global_configs` / `programs`;
5. `fee_economic_assessment.provenance`;
6. Phase 11 eligibility and final score on the same scan run.

No scoring-weight redesign was introduced.

------------------------------------------------------------------------

# 35I. BATCH 4 — TEST & BASELINE RECONCILIATION

Tanggal: 2026-10-06 (WIB)

## Scope

Batch 4 does not redesign production scoring or coverage semantics. It
reconciles regression contracts with the already-validated production
semantics and makes the package regression suite reproducible from a fresh
unzip.

### TEST-01 — Phase 11 fixture drift

The obsolete hard-coded expectation `74` is not used as a production baseline.
The replacement regression derives the expected final score from the fixture's
eligible dimensions and the locked weighted-mean method.

For the Batch 4 deterministic fixture:

- token_control = 100, weight 20;
- holder_distribution = 75, weight 20;
- creator_activity = 65, weight 15;
- fee_utility = unavailable, excluded from denominator;
- risk_findings = 25, weight 25;
- expected final score = **64/100**.

A second assertion changes only fixture evidence and confirms that the score
changes while the Phase 11 scoring method/version remains unchanged.

Decision: **TEST BASELINE DRIFT RECONCILED**.

### TEST-02 — Phase 5 bounded coverage contract

Regression now explicitly verifies:

- configured page cap → `PARTIAL / PAGE_LIMIT / PAGINATED_BOUNDED / CONFIGURED_PAGE_WINDOW`;
- normal end of pagination → `COMPLETE / NO_MORE_DATA / FULL_AVAILABLE_DATA`;
- explicit completed empty retrieval → `EMPTY / NO_MATCH`;
- retrieval not attempted/unavailable → `UNKNOWN / NOT_AVAILABLE`.

Production Phase 5 coverage source was not weakened to satisfy the obsolete
expectation.

Decision: **TEST CONTRACT DRIFT RECONCILED**.

### Test portability — Phase 9 liquidity-pool regression

The previous test depended on runtime `Output/<CA>/phase8-result.json` and
failed in a clean package with `ENOENT`.

Batch 4 moves the minimal deterministic regression data into:

`tests/fixtures/phase9_liquidity_pool/`

The fixture preserves the important regression condition: the confirmed
PumpSwap liquidity-pool address has SELL events, while a normal holder has a
valid concentrated SELL pattern. The test therefore verifies that only the
liquidity pool is excluded from wallet-level SPR-02 and the normal holder can
still trigger it.

Decision: **TEST FIXTURE PORTABILITY RECONCILED**.

## Batch 4 regression result

Fresh-package `npm test` result:

```text
30 tests
30 PASS
0 FAIL
0 skipped
0 cancelled
```

This is a package-level regression result. It is not yet the final Stage 5
54-test official-baseline gate, and it does not replace the pending seven-CA
real-output regression.

## Production source boundary

Batch 4 intentionally does not modify:

- Phase 11 weighted formula or weights;
- Phase 10 BA / Wallet DB scoring;
- Phase 5 coverage semantics;
- Phase 9 SPR-02 threshold;
- Phase 4 liquidity-pool classification;
- Phase 6 evidence identity/dedup semantics.

The Batch 4 production source changes are therefore limited to regression
support/packaging and documentation; the relevant production implementations
are validated by tests rather than altered to satisfy stale assertions.

## Remaining gate after Batch 4

1. final security/config audit;
2. official 54-test baseline regression with reconciled contracts;
3. seven-CA regression;
4. cross-CA score/evidence/coverage comparison;
5. final HTML/report audit.
