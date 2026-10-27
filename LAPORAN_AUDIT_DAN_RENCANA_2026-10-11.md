# Laporan Audit & Pengembangan — Solana Token Intelligence
**Tanggal:** 2026-10-11 · **Oleh:** π · **Untuk:** Rin
**Terakhir diperbarui:** 2026-10-21 (Ronde 21 — P3 coverage Phase 8 (antrean tier, preset retry, peringatan sidecar))
**Cakupan:** seluruh isi `Solana_token_intelligence_0_s7m4.zip` (162 file) — kode, config, data, docs, test, dan hasil scan.

---

## 1. Peta paket (arsitektur)

Pipeline Node.js 100% tanpa dependensi eksternal (sekarang resmi 0 dependency):

| # | Script | Tugas |
|---|--------|-------|
| 1 | `phase1_token_discovery` | Validasi mint + metadata dasar via Helius |
| 2 | `phase2_token_authority_supply` | Mint/freeze authority, supply, decimals |
| 3 | `phase3_holder_discovery` | Top holder via getTokenLargestAccounts |
| 4 | `phase4_holder_concentration` | Konsentrasi, klasifikasi holder (LP/BURN/NORMAL/…), peta likuiditas |
| 5 | `phase5_creator_dev_analysis` | Creator discovery, distribusi awal, deteksi bundler, event jual creator |
| 6 | `phase6_fee_trading_economics` | Atribusi fee (LP / protokol / coin-creator), gate verifikasi |
| 7 | `phase7_database_wallet_matching` | Pencocokan 884 wallet database (Dev/Rug/early/Whale) |
| 8 | `phase8_wallet_behavior_timeline` | Timeline per-wallet (BUY/SELL/TRANSFER), posisi, Behavior Adjustment |
| 9 | `phase9_risk_engine` | 18 rule risiko (SPR/CTR/TCR/LTR) — hanya SPR-02 & CTR-03 punya evaluator eksplisit |
| 10 | `phase10_scoring_engine` | Agregasi evidence group → risk score |
| 11 | `phase12_early_signals` | **BARU (2026-10-11):** rug checklist, early-bird, kandidat bundler, verdict — 100% offline |
| — | `generate_html_report.js` | Generator `report.html` (dipakai menu) |
| — | `behavior_adjustment_engine.js`, `coverage_contract.js`, `wallet_role_normalizer.js`, `run_metadata.js`, `phase5_coverage.js` | Modul pendukung |

Entry point: `main.js` (menu interaktif 01–12, 00 = full pipeline, 13 = HTML report, X = keluar).

### Aturan terkunci (tidak boleh diubah — dari audit historis)
- Formula Phase 11: weighted mean dimensi available, bobot 20/20/15/10/25.
- DB Weight dan Behavior Adjustment tetap terpisah.
- BA: SELL "large portion" ≥50% akuisisi; modifier SELL clamp [-100,0]; rekonsiliasi posisi exact.
- Phase 9: transfer ≠ sell; CTR-03 = asosiasi temporal, bukan kausalitas.
- fee_utility unavailable → dikeluarkan dari denominator, bukan dinilai 0.
- UNKNOWN/PARTIAL/SAMPLED bukan bukti negatif; risk null ≠ 0.
- POOL_COIN_CREATOR ≠ PROJECT_CREATOR.

---

## 2. Bug & masalah — daftar lengkap berprioritas

### P0 — Keamanan (SELESAI, klarifikasi 2026-10-11 siang)
| # | Temuan | Status |
|---|--------|--------|
| P0-1 | **API key Helius asli tertanam di `Config/config.json`** (timestamp file 3 menit lebih baru dari file lain — indikasi disisipkan pasca-packaging). | ✅ D sanitasi ke placeholder. **Klarifikasi Rin: key tersebut adalah key trial yang memang sengaja diberikan untuk dipakai test internal** — jadi tidak perlu rotasi. Key disimpan di `~/.sti_helius_trial_key` (di luar paket, mode 600) dan hanya diinjeksikan sementara saat test live via `~/workspace/sti_live/run_live_validate.sh` (selalu restore placeholder via trap). Paket shareable tidak pernah menyimpan key. |

### P1 — Bug semantik/data (SELESAI)
| # | Temuan | Dampak | Status |
|---|--------|--------|--------|
| P1-1 | Phase 11 `creator_activity` memakai kosakata status yang salah (`SELL_DETECTED`/`NO_SELL_DETECTED`, padahal Phase 5 mengeluarkan `FOUND`/`NO_SELL_OBSERVED_WITHIN_COVERAGE`) → status valid jatuh ke netral 50. | Skor final 8DXq salah: 57, seharusnya 60. | ✅ Diperbaiki. Formula tetap terkunci; yang berubah hanya pemetaan input. Rev: skor 8DXq kini **58/100** (confidence 56.92) setelah SPR-01/SPR-04 menambah temuan lewat pipeline terkunci — 57→60 (bugfix) →56 (SPR-04) →58 (dedup novelty bekerja). |
| P1-2 | `num(null)` di generator HTML → `Number(null)` = 0 → 42/47 wallet tampil "Supply 0%" (temuan 6O #1). | Holder terbesar 16,58% pun tampil 0%. | ✅ Diperbaiki: null tampil "N/A". |
| P1-3 | `renderRisk` baca `evidence_refs` yang tidak pernah ada (Phase 10 menulis `source_refs`/`evidence_identities`) → "Evidence refs: 0" (temuan 6O #3). | Group SPR-02 (15 refs) & CTR-03 (8 refs) tampil 0. | ✅ Diperbaiki. |
| P1-4 | CTR-03 tidak mengecualikan `LIQUIDITY_POOL` (SPR-02 sudah) → akun pool `CbR2U…` jadi subjek risk group 63 (temuan 6O #4). | False positive wallet-level. | ✅ Diperbaiki (mirror SPR-02). Regresi 7 CA: tidak ada LP tersisa sebagai subjek; CTR-03 tetap terpicu untuk wallet asli. |
| P1-5 | `evidence_signatures` provenance Phase 6 tidak di-dedup defensif (temuan 6O #5: 34 entri, 17 unik di artefak lama). | Provenance bisa menggandakan bukti. | ✅ Diperbaiki: `unique()` + count dari list unik. |
| P1-6 | Ternary mati di Phase 5: kedua cabang `NO_SELL_OBSERVED_WITHIN_COVERAGE` identik. | Dead code, membingungkan. | ✅ Disederhanakan. |
| P1-7 | Phase 3: decimals tak dikenal default 0 → `amount_ui` = raw (salah unit). | Data menyesatkan saat decimals hilang. | ✅ Diperbaiki: null bila tak dikenal. |
| P1-8 | Test baseline stale: confidence 52.88 vs artefak deterministik 54.14; test key bertentangan dengan isi paket. | `npm test` gagal 2/6. | ✅ Test disinkronkan dengan penjelasan. |

### P2 — Kebersihan paket (SELESAI)
| # | Temuan | Status |
|---|--------|--------|
| P2-1 | `package.json` dependensi `run`+`test` — paket npm tak terkait, tidak pernah di-`require`. Risiko typosquatting. | ✅ Dihapus; `package-lock.json` dibuang. Proyek kini 0 dependency. |
| P2-2 | File mati: `Script.zip`, `Output/output.zip` (duplikat stale), `phase11_final_report.js.bak` (v1.1.1 pre-6M, risiko tertukar), `html_report_generator.js` (generator lama tak terpakai), `Config/scoring.json` (dead config; skemanya pun tak cocok dengan 5 dimensi Phase 11). | ✅ Dipindah ke `Archive/` + `Archive/README.md`. |
| P2-3 | Menu: HTML report di key `12` bentrok dengan phase baru. | ✅ Phase 12 = menu `12`; HTML report pindah ke `13`. Pipeline `00` kini 1–12. |

### P3 — Keterbatasan (status 2026-10-11 siang)
| # | Temuan | Status |
|---|--------|--------|
| P3-1 | **Rule Phase 9 tanpa evaluator eksplisit.** | 🔄 **Progres 2026-10-11:** kini **10/18 rule punya evaluator eksplisit** (dulu 2/18): SPR-01/02/04/05, CTR-01/02/03, LTR-01/02/03; TCR-01/02 diagnostik jujur. Baru: `Script/collect_funding_graph.js` (Phase 8B — baca phase8 lama, tanpa rescan penuh) membuka CTR-01/02; Phase 4 mengarsip `liquidity_history.jsonl` per scan membuka LTR-02/03 (cukup scan Phase 4 dua kali). Sisa 8 rule (CTR-04, TCR-03/04, SPR-03, LTR-04): butuh volume market total / model price-impact — desain dulu. |
| P3-2 | **Validasi realtime RPC belum pernah dilakukan pasca-patch.** | ⚠️ **Terblokir infrastruktur:** server π tidak dapat mencapai Helius RPC — semua domain Helius di-resolve ke 198.18.x.x (intercept/blackhole), curl timeout. Key trial valid dan tersimpan aman di `~/.sti_helius_trial_key`. Live scan harus jalan dari jaringan yang tidak memblokir Helius. Script siap: `~/workspace/sti_live/run_live_validate.sh`. |
| P3-3 | `protocol_state.status` bisa tertinggal UNKNOWN (PH6-20/32). | ✅ **Diperbaiki:** `finalizeProtocolState()` di semua exit path (early-return RPC gagal → `NOT_DETERMINED`; tanpa pool didukung → `NOT_APPLICABLE`). 6 unit test baru. |
| P3-4 | BA coverage: 47/54 wallet INSUFFICIENT_DATA — BA belum tervalidasi umum. | Perluas jangkauan history atau turunkan klaim BA. |
| P3-5 | Database wallet 884 entri, 53,7% tanpa `groups` → DEFAULT (bobot 1). | 🔍 **Analisis:** 884 address unik (tanpa duplikat); 475 tanpa group adalah bulk import seragam (nama kosong/numerik) — tidak ada sinyal untuk inferensi. **Butuh kurasi Rin** atau pruning; π tidak memfabrikasi label. |
| P3-6 | Hash SHA-256 source tidak cocok dengan dokumen Batch lama; tidak ada dokumen hash untuk build 6M. | ✅ **Diperbaiki:** `Docs/BUILD_HASHES_2026-10-11.md`. |
| P3-7 | Klaim "54 test / 30 test PASS" di docs tidak bisa direproduksi. | Suite kini **43 test** (`npm test` hijau). Selaraskan klaim docs atau sertakan suite historis. |

## 4. Rencana kerja lanjutan (prioritas)

**Status 2026-10-11 siang (Rin: "kerjakan"):**

✅ **Selesai:**
- Evaluator SPR-01 penuh + diagnostik TCR-01/02 (kontrak evidence diaudit; 6+6 test baru)
- Finalisasi `protocol_state` Phase 6 (PH6-20/32)
- `Docs/BUILD_HASHES_2026-10-11.md`
- Analisis database wallet (butuh kurasi Rin — lihat P3-5)
- Key trial disimpan aman di luar paket; skrip live-test siap (`~/workspace/sti_live/run_live_validate.sh`)

⚠️ **Terblokir (butuh jaringan yang tidak memblokir Helius):**
- 1 scan live validasi pasca-patch — server π tidak bisa mencapai Helius RPC (DNS di-intercept ke 198.18.x.x). Bisa dijalankan dari HP/laptop Rin atau setelah kebijakan egress berubah; π akan aktif menjalankannya saat memungkinkan.

**Berikutnya:**
- Evaluator eksplisit untuk 12 rule tersisa (bertahap, dengan kontrak evidence): CTR-01/02/04 (butuh funding graph), TCR-03/04 & SPR-03 (butuh volume market total — problem representativitas), LTR-02/03/04 (butuh seri snapshot likuiditas historis — desain pengambilan data dulu)
- Selaraskan klaim jumlah test di README/docs dengan isi paket
- Ingestion sinyal sosial semi-otomatis (X/Reddit) — butuh akses API; X login masih rate-limited sejak 2026-10-06

**Jangan dilakukan tanpa persetujuan eksplisit:** mengubah formula/bobot Phase 11, menggabung DB Weight + Behavior Adjustment, mengklaim social virality sebagai bukti keamanan token.

---

## 5. File yang berubah di sesi ini
- `Config/config.json` — key disanitasi; tambah section `early_signals`
- `Script/phase9_risk_engine.js` — CTR-03 LP exclusion
- `Script/phase11_final_report.js` — mapping status creator_activity
- `Script/generate_html_report.js` — `num(null)`→N/A; evidence refs; section Phase 12
- `Script/phase5_creator_dev_analysis.js` — ternary mati; dead assignment
- `Script/phase6_fee_trading_economics.js` — dedup evidence_signatures
- `Script/phase3_holder_discovery.js` — decimals null-safe
- `Script/phase12_early_signals.js` — BARU
- `main.js` — menu 12/13, pipeline 1–12
- `package.json` — 0 dependency; `package-lock.json` dihapus
- `Archive/` — file mati + README
- `tests/` — 43/43 hijau (`p0-runtime` [6], `phase12` [7], `phase9_spr01` [6], `phase9_spr04_05_ltr01` [6], `phase9_ltr02_ctr` [12], `phase6_protocol_state` [6])
- `Config/phase9_rules.json` — threshold SPR-01 dipakai evaluator; kontrak evidence SPR-01/TCR-01/02
- `Docs/BUILD_HASHES_2026-10-11.md` — BARU
- `Output/8DXq…/` — phase9/10/11/12 + report.html diregenerasi
- `Data/social_signals.example.json` — BARU

---

## Ronde 4 — 8 rule Phase 9 tersisa (2026-10-11 malam)

Atas permintaan Rin ("kerjakan 8 rule yang tersisa"). Rekonsiliasi jujur: dari 18 rule,
11 sudah punya evaluator kode (SPR-01/02/04/05, CTR-01/02/03/05, LTR-01/02/03), 2 diagnostik-only
(TCR-01/02), 5 tanpa evaluator (SPR-03, CTR-04, TCR-03/04, LTR-04). CTR-05 punya evaluator tapi
tak pernah bisa fire (relationship evidence tak diisi kolektor).

### Yang dikerjakan
1. **Kolektor market volume** `Script/collect_market_volume.js` (Phase 8C, menu `15`, opt-in):
   paginasi `getSignaturesForAddress` + `getTransaction(jsonParsed)`, klasifikasi heuristik
   BUY/SELL/TRANSFER dari delta token vs delta SOL (SOL-quote only, fee buffer 8000 lamports,
   didokumentasikan). Output `Output/<mint>/market-volume.json` dengan `completeness`
   jujur (`complete` hanya bila paginasi tuntas tanpa menyentuh `--max-tx`). Bawaan 1500 tx.
2. **5 evaluator gated market-wide** (hanya fire bila `completeness='complete'`; tanpa itu
   INSUFFICIENT_DATA — tidak pernah trigger palsu, tidak pernah NOT_TRIGGERED dari data kurang):
   SPR-03 (connected sell / market trade ≥0.05), CTR-04 (connected trade ≥0.1),
   TCR-01/02 (top seller/buyer share ≥0.3; tanpa sidecar tetap publikasi diagnostik bounded-sample),
   TCR-03 (connected concentration ≥0.5). Numerator dibaca dari sidecar (interval & unit selaras
   dengan denominator), bukan dari sampel bounded Phase 8. Connected set = creator+dev+related Phase 5.
3. **TCR-04 real** (tanpa data market-wide): delta HHI (skala 0–100) volume BUY+SELL per wallet
   antara paruh H1/H2 window observasi, wallet set SAMA (complete history + observable sejak awal
   window = "matching coverage"). Threshold `threshold_pp: 15` (dari config). Small-sample guard:
   tiap paruh butuh ≥10 event unik (HHI paruh nyaris kosong mekanis ekstrem — 1 token 7CA sempat
   false-trigger sebelum guard ditambahkan, diverifikasi hilang setelah guard).
4. **LTR-04 real**: model constant-product `impact = v/(R+v)` untuk stress = total observed SELL
   volume vs reserve base pool. Hanya untuk protokol tervalidasi (PumpSwap/Raydium); protokol lain →
   INSUFFICIENT_DATA. Diberi label tegas sebagai ESTIMASI TEORITIS, bukan observed impact.
5. **CTR-05**: evaluator terverifikasi + test path TRIGGERED (2 sekuens relationship_verified);
   dokumentasi bahwa kolektor live belum mengisi relationship evidence.

### Validasi
- `npm test`: **71/71 PASS** (+28 test baru di `tests/phase9_round4.test.js`).
- Regresi 7CA: 5 rule market-gated → INSUFFICIENT_DATA semua (tanpa sidecar); TCR-04: 1 NOT_TRIGGERED
  sah + 6 INSUFFICIENT_DATA; LTR-04: INSUFFICIENT_DATA semua; CTR-05: INSUFFICIENT_DATA semua.
  Rule lama (SPR-01/02/04, CTR-03) tak berubah perilakunya — baseline 7CA Oct-09 memang usang
  (pra-evaluator), bukan regresi.
- 8DXq: **0 perubahan status** rule mana pun (TCR-04 kini INSUFFICIENT_DATA dengan metric terhitung:
  3 comparable wallets, H2=0 event). Skor 58/100 & confidence 56,92 tidak berubah.

### Status akhir
18/18 rule kini punya implementasi evaluator. 5 di antaranya (SPR-03, CTR-04, TCR-01/02/03)
tergantung `market-volume.json` complete — kolektornya opt-in karena mahal di RPC trial key;
Rin menjalankannya dari Termux bila dibutuhkan. Formula Phase 11 & bobot scoring tidak disentuh.

---

## Ronde 5 — Bugfix dari run Termux Rin (2026-10-11 siang)

Rin menjalankan menu 15 (market volume) + menu 9 (Phase 9) di Termux untuk 8DXq dan
melaporkan hasilnya. Dari file yang diunggah ditemukan DUA bug nyata:

### Bug 1 (kritis): Phase 9 explicit-mint mengabaikan semua sidecar
`main()` di `phase9_risk_engine.js` tidak meneruskan `mint` ke `runEvaluation`
pada path explicit-mint (menu 9). Akibatnya `outDir=null` dan ketiga sidecar —
`funding-graph.json`, `liquidity_history.jsonl`, `market-volume.json` — diam-diam
diabaikan. Buktinya: file market-volume Rin terkumpul 00:56 UTC, Phase 9 jalan 01:07 UTC,
tapi reason-nya "No market-volume.json found". Bug ini juga berarti CTR-01/02 (funding graph)
tidak pernah bisa dievaluasi via menu selama ini.
Fix: satu baris — `mint:requestedMint` pada konstruksi input explicit-mint.
Test: repro end-to-end via child process `node Script/phase9_risk_engine.js <mint>`
dengan sidecar di disk (persis perintah Rin) — SPR-03 kini TRIGGERED seperti seharusnya.

### Bug 2: classifier market-volume mengukur SOL di akun yang salah
`classifyTxFlow` menjumlah delta SOL hanya pada index akun TOKEN (ATA). ATA tidak
menyimpan SOL, jadi sol_delta selalu ~0 dan SEMUA swap terklasifikasi TRANSFER —
inilah sebabnya hasil Rin: BUY/SELL = 0/0 walau transfer_volume 252T raw.
Fix (v1.0.1): delta SOL dijumlahkan pada SEMUA index akun yang pubkey-nya == owner
(akun native SOL-nya). Keterbatasan WSOL-route didokumentasikan.
Test: bentuk transaksi realistis (akun SOL index 0 terpisah dari ATA index 1) —
BUY/SELL kini terdeteksi; shape lama tetap lolos.

### Catatan untuk run Rin berikutnya
- File `market-volume.json` yang lama (0/0) harus dibuang & kolektor dijalankan ulang
  setelah update file — datanya cacat karena Bug 2.
- Untuk `completeness: complete` butuh `--max-tx` ≥ total signature (terlihat ≥2000;
  total pastinya belum diketahui karena cap tersentuh — coba 5000). Estimasi ~5000
  panggilan RPC; 339/1500 gagal di run pertama kemungkinan jaringan HP — run ulang
  biasanya memulihkan sebagian.
- Phase 9 berperilaku BENAR selama ini: 4 TRIGGERED / 14 INSUFFICIENT_DATA, tanpa
  false trigger dari file PARTIAL — gate kejujuran bekerja.

### Validasi
- `npm test`: **78/78 PASS** (+7 test ronde 5 di `tests/phase9_round5.test.js`).
- Build hashes diregenerasi (rev 4.1).

---

## Ronde 6 — Sudut pandang baru untuk rule market (2026-10-11 siang)

Usulan Rin: berhenti menaikkan `--max-tx` demi `complete` (token tua = riwayat terlalu
besar untuk trial key), ubah sudut pandang rule, jangan memaksa trigger — tapi dengan
data yang ada, tarik kesimpulan yang lebih relevan.

### Temuan dari run Rin (file diunggah)
- Kolektor v1.0.1 bekerja: BUY 31,0T / SELL 31,9T raw terdeteksi (sebelumnya 0/0).
  Top seller window: 16,01% (2 tx), top buyer: 14,48% (174 tx — trader frekuensi tinggi).
- Plumbing fix bekerja: CTR-02 kini TRIGGERED (1 funding→trade sequence — "tambahan
  triggered" yang Rin lihat), CTR-01 NOT_TRIGGERED jujur (0 shared funder).
- Bug kecil #3: `window` selalu null — `blockTime` ada di TOP-LEVEL hasil getTransaction,
  bukan di dalam `meta`. Fix di v1.0.2 (berdampak hanya pada karakterisasi window;
  klasifikasi tak terpengaruh).

### Reframing: evaluasi bertingkat (tiered)
Lima rule market (SPR-03, CTR-04, TCR-01/02/03) kini dievaluasi bertingkat:
- `complete` → klaim market-wide (seperti semula).
- `windowed` (partial, ≥500 parsed — adequacy floor, uncalibrated) → metrik dihitung
  pada WINDOW TERAMATI (transaksi terbaru; paginasi newest-first), scope
  `windowed_recent_signatures` + karakterisasi window diungkap di metric.
  Ini setia pada deskripsi SPR-03 ("for the same interval"): numerator & denominator
  pada interval yang sama — intervalnya = window observasi.
- `none`/`unusable` → INSUFFICIENT_DATA (TCR-01/02 tetap publikasi diagnostik).
Threshold config TIDAK berubah. Tidak ada yang dipaksa: simulasi file partial Rin
menghasilkan 5× NOT_TRIGGERED yang jujur (SPR-03/CTR-04/TCR-03: 0% — kreator tak aktif
di window; TCR-01: 16,01%; TCR-02: 14,48%).

### Validasi
- `npm test`: **87/87 PASS** (9 test tiered + 3 test blockTime baru).
- Regresi 7CA bersih; 8DXq tanpa sidecar: 0 perubahan status.

---

## PENGUNCIAN Phase 9 (2026-10-11 sore, atas pernyataan Rin)

Rin menyatakan Phase 9 "sudah bisa dikunci" — tidak perlu run ulang downstream
(10/11/12) karena tidak ada perubahan untuk phase berikutnya; `npm test` cukup
sebagai validasi.

**Yang dikunci** (perubahan butuh keputusan eksplisit Rin, sama seperti formula Phase 11):
- 18 rule Phase 9 di `Config/phase9_rules.json`: threshold, window_seconds, min_count,
  threshold_pp, operator, dan status enabled.
- Kontrak evidence & tier evaluasi di `Script/phase9_risk_engine.js`:
  SPR-01/04 (ledger discipline), SPR-05/LTR-01 (sell vs likuiditas),
  LTR-02/03 (liquidity history), LTR-04 (constant-product, PumpSwap/Raydium only),
  CTR-01/02 (funding graph), CTR-03/05 (transfer→sell), SPR-03/CTR-04/TCR-01/02/03
  (tiered: complete/windowed/unusable; adequacy floor 500 parsed),
  TCR-04 (HHI delta, threshold_pp 15, small-sample guard 10/half).
- Prinsip: missing/partial data → INSUFFICIENT_DATA (tidak pernah NOT_TRIGGERED);
  social virality bukan bukti; transfer-out bukan SELL.

**Status akhir terkunci:** 18/18 rule punya evaluator; 7 INSUFFICIENT_DATA murni karena
data belum ada (snapshot likuiditas Phase 4, relationship evidence, dst.) — bukan
karena kode kurang. Test 87/87 PASS. Paket final: rev5.

---

## Ronde 7 — Retry hardening kolektor market volume (2026-10-11 sore)

Atas permintaan Rin ("perkuat kolektor agar bisa meminimalisir retry failed").
Latar: run 8DXq Rin mencatat 508/1500 gagal (jaringan HP).

### Perubahan (`Script/collect_market_volume.js` v1.0.3)
- Hasil fetch diklasifikasi: `ok` / `retryable` (error jaringan, RPC error, timeout,
  429 — layak coba lagi) / `permanent` (tx tidak ditemukan / hasil parse tak bisa
  dipakai — retry tak ada gunanya, mis. tx on-chain yang gagal).
- Retry passes khusus (bawaan 2): HANYA signature retryable yang di-fetch ulang;
  yang sukses tidak diulang (hemat RPC). Tiap retry pass memakai timeout 2× lipat
  (cap 60 detik) dan jeda antar panggilan yang lebih longgar.
- Argumen baru: `--retry-passes`, `--retry-delay-ms`, `--timeout-ms`.
- Statistik retry tercatat di `market-volume.json` (coverage): pulih, tersisa,
  permanen skip.
- Phase 9 dan seluruh rule TIDAK berubah (tetap terkunci ronde 6).

### Validasi
- `npm test`: **94/94 PASS** (+7 test: fetchAndClassify ok/retryable/permanent,
  orkestrasi collectSignatures, timeout retry 2×).
- Kompatibel mundur: format `market-volume.json` hanya bertambah field;
  evaluator Phase 9 membaca field yang sama.

---

## Ronde 8 — Setting kolektor via config.json (2026-10-11 malam)

Atas permintaan Rin: semua setting fleksibel kolektor market volume cukup diatur di
`Config/config.json`, tanpa bongkar script — konsisten dengan phase lain.

### Perubahan
- `Config/config.json`: section baru `market_volume` (max_tx 1500, delay_ms 300,
  page_limit 1000, retry_passes 2, retry_delay_ms 1500, timeout_ms 25000).
- `Script/collect_market_volume.js` v1.0.4: fungsi murni `resolveCollectorOpts`
  dengan precedence **flag CLI > config.json > bawaan** + sanitasi batas
  (termasuk perbaikan bug nama key snake_case vs camelCase saat implementasi).
  Setting efektif dan sumbernya ditampilkan setiap run dan dicatat di
  `market-volume.json` (`collector_config`) untuk provenance.
- Menu 15 (tanpa flag) otomatis memakai config.json. `set_key.js` tidak menghapus
  section lain — aman untuk config yang sudah berisi key.
- Phase 9 dan seluruh rule TIDAK berubah (tetap terkunci).

### Validasi
- `npm test`: **99/99 PASS** (+5 test precedence/sanitasi).

---

## Ronde 9 — Kolektor Reddit untuk Phase 12 (2026-10-11 malam)

Atas permintaan Rin ("bangun kolektor Reddit") — menutup bagian intelijen sosial
dari permintaan awal yang belum terbangun (login X masih diblokir; Reddit bisa
dibaca publik tanpa login).

### Temuan keterjangkauan
Dari server π: `www.reddit.com` → HTTP 403 (login-wall, semua UA), `old.reddit.com`
→ redirect ke halaman login, `api.arctic-shift.com` → tak terjangkau. Koleksi live
Reddit harus dari jaringan yang mengizinkan (HP Rin, seperti kolektor Helius).

### Perubahan
- BARU `Script/collect_social_reddit.js` v1.0.0 (menu `16`, dikecualikan dari
  pipeline seperti 14/15): query ticker (+nama opsional) di subreddit meme coin
  via search.json publik; ticker auto-detect dari `phase1-result.json`
  (override `--ticker`); arsip mentah per postingan; gabung ke
  `Data/social_signals.json` tanpa menimpa data X yang ada.
- Prinsip jujur: sentimen selalu `unknown` (tanpa model NLP); saat terblokir
  (403/429/redirect login) kolektor melapor jelas dan berhenti — tidak memalsukan
  data; tiap subreddit yang gagal dicatat di output.
- `Config/config.json`: section `social_reddit`; precedence flag CLI > config > bawaan.
- Phase 9/11/12 dan seluruh rule TIDAK berubah (tetap terkunci). Phase 12 membaca
  file ini sebagai info saja — tidak mengubah verdict (sesuai prinsip terkunci).

### Validasi
- `npm test`: **108/108 PASS** (+9 test parsing/dedupe/window/merge/precedence).
- Smoke test live dari server π: ticker 8DXq terdeteksi (`moin`), 403 tertangani
  via jalur fail-soft tanpa crash; artefak test dibersihkan.

---

## Ronde 9b — Penggabungan X + Reddit (2026-10-11 malam)

Atas pertanyaan Rin soal gabungan X (bukan hanya Reddit).

### Verifikasi langsung
Otomatisasi X tanpa login tidak mungkin: bearer publik web X me-return 401
"Invalid or expired token" (2026-10-11), Nitter mati sejak 2024, semua endpoint
publik kini login-wall. Satu-satunya jalur otomatis adalah login X Rin (masih
dibatasi sejak 2026-10-06 — menunggu keputusan Rin) atau X API berbayar.

### Perubahan
- BARU `Script/set_social_x.js`: helper catat sinyal X manual
  (`<MINT> <X_MENTIONS_24H> [--sentiment] [--note]`) ke `Data/social_signals.json`
  tanpa menimpa data Reddit dari kolektor; sentimen yang diisi manusia
  mengalahkan label `unknown`; menampilkan heat gabungan X+Reddit.
- Phase 9/11/12 dan seluruh rule TIDAK berubah (tetap terkunci).

### Validasi
- `npm test`: **110/110 PASS** (+2 test mergeXDoc).

## Ronde 10 — Integrasi wallet DB ke scoring, Opsi B (2026-10-11 malam)

Keputusan Rin: 🚫 = -10, 🚩 = -5 (config-driven via `scoring.modifiers`); kunci
Phase 11 DIBUKA khusus untuk integrasi ini — DB weight digabung ke skor akhir
(bukan dipisah, karena dipisah menambah faktor bias). Visi: DB menjawab "apakah
CA populer di antara wallet DB, dan apa yang terjadi" (sell koordinat, bundler,
fast exit, retention).

### Yang dibangun
- BARU `Script/db_conviction_metrics.js`: 6 metrik per token dari Phase 7+8+5
  (penetration, retention, coordinated_sell, fast_exit, conviction, bundler_overlap
  + dev_concentration). Murni, config-driven (`database_conviction`), tidak
  memaksa kesimpulan: data kurang -> INSUFFICIENT_DATA -> adjustment dilewati.
- `Script/phase11_final_report.js`: `scoreDimensions` menerapkan adjustment aditif
  per dimensi (clamp [-15,15]/dimensi, skor akhir tetap [0,100]):
  holder_distribution <- retention/conviction; risk_findings <- coordinated_sell/
  fast_exit/negative_conviction; creator_activity <- bundler_overlap;
  token_control <- dev_concentration; fee_utility tidak disentuh (tidak ada
  pemetaan jujur). Tiap dimensi mencatat komponen adjustment di `details`
  (transparan, bisa dilacak).
- `Config/config.json`: section `database_conviction` (semua bobot & ambang).
- Patch `extractModifiers`: 🚩/🚫 dikenali (default -5/-10, override via config).

### Fakta arsitektur yang dikoreksi
- Sebelum ronde ini wallet DB TIDAK memengaruhi skor akhir: Phase 10 memetakan
  P7-WALLET-MATCHING sebagai observasi dengan risk null; Phase 11 tidak membaca
  database_weight; `phase10_wallet_intelligence_simulation.js` adalah dead code.
- Role DEV (-1) dan RUG/KOL (-2) sudah negatif sejak awal di
  `scoring.wallet_weights`; yang baru adalah modifier emoji negatif.
- DB Rin 2026-10-11: 9 wallet ber-emoji negatif (stacking aditif: DEV+🚫=-11,
  RUG/KOL+🚩=-7); 475 alamat masih tanpa group.

### Validasi
- `npm test`: **137/137 PASS** (+16 test metrik & wiring, termasuk regresi
  "tanpa data Phase 7/8 -> skor identik seperti sebelum Opsi B").
- Dry-run wiring pada data regresi 7CA asli (FvML...omo, 9 wallet match):
  holder -5.9, risk -11.24, creator +0 (jujur), token_control & fee_utility
  tidak diubah. Satu bug tertangkap saat testing: `supply_percentage: null`
  terbaca sebagai 0 (`Number(null)===0`) -> diperbaiki dengan cek null eksplisit.
- Catatan: skor 8DXq akan bergeser pada scan berikutnya karena adjustment kini
  aktif — itu disengaja, bukan regresi.

---

## Ronde 11 — Prioritas Rin 2–4 + Default group (2026-10-12 ~02:00 WIB)

Rin menetapkan prioritas: (2) CTR-05, (3) parser, (4) diagnostik stabilitas window;
plus (5) group "Default" eksplisit untuk 475 alamat tanpa group — Default adalah
kelompok awal sebelum promosi ke early/whale/dev/rug, bobot positif terendah (1).

### #2 CTR-05: jalur data relationship evidence (SELESAI)
- Masalah: CTR-05 butuh `relationship_id` + `relationship_verified` yang sama pada
  event transfer dan SELL berikutnya — tidak ada kolektor yang mengisinya.
- Solusi: `Script/relationship_annotator.js` (baru, murni) menganotasi event dari
  `funding-graph.json` (Phase 8B): dua wallet berbagi funder -> id `funder:<F>`.
  Greedy berdasarkan waktu, cerminan `transferSellSequences`; tidak menimpa
  anotasi yang sudah ada; kill-switch via config `relationships.enabled`.
- Wiring di `runEvaluation` (5 baris): anotasi berjalan sebelum evaluasi rule.
  Rule, threshold, window, status TIDAK diubah — hanya evidence yang diisi.
- Butuh menu 14 (funding graph) sebelum menu 9; tanpanya CTR-05 tetap
  INSUFFICIENT_DATA (tidak dipaksa). CTR-03 tidak terpengaruh (diverifikasi test).
- Test: 14/14 PASS termasuk e2e TRIGGERED via sidecar.

### #3 Parser: akun ditutup + instrumentasi (SELESAI)
- Temuan: akun yang ditutup dalam tx (postTokenBalances hilang) di-skip total —
  padahal itu pola "jual habis lalu tutup ATA". SELL-all hilang diam-diam.
- Fix (kolektor v1.0.5): post null & pre > 0 -> delta = -pre, flag
  `account_closed: true`; agregasi per owner tetap menetralkan transfer antar-ATA
  sendiri (tidak ada false SELL — diverifikasi test).
- Instrumentasi baru di coverage: `permanent_skip_reasons` (breakdown alasan),
  `closed_account_flows_recovered` (counter). Volume SELL koleksi berikutnya
  dapat naik — itu koreksi, bukan anomali.
- Test: 6/6 PASS.

### #4 Diagnostik stabilitas window (SELESAI)
- Kolektor v1.0.5 membagi paruh window menurut urutan fetch (newest-first):
  `halves.recent` / `halves.older` pada totals dan per-wallet.
- Phase 9: `metric.window_stability` pada SPR-03/CTR-04/TCR-03 (connected share
  per paruh) dan TCR-01/02 (top wallet per paruh + spread_pp). Diagnostik saja —
  status/threshold terkunci tidak tersentuh. File lama -> `available: false`
  dengan alasan jujur (butuh menu 15 ulang).
- Test: 8/8 PASS termasuk e2e (status TRIGGERED tak berubah oleh diagnostik).

### #5 Default group (SELESAI)
- 475 alamat tanpa group kini eksplisit `groups: ["Default"]`; 0 duplikat.
- Bobot: Default 1, early 2, whale 3, dev -1, rug/kol -2 (terverifikasi via
  calculateRoleWeight). Tidak mengubah skor — hanya pencatatan.

### Validasi ronde 11
- `npm test` working copy π: **154/154 PASS** (126 + 28 test baru).
- File handoff di `~/workspace/`: fix1e_collect_market_volume_v105.js,
  fix2c_phase9_risk_engine_ctr05_window.js, new_relationship_annotator.js,
  3 file test baru, database-wallet_default-group.json, INSTALL_ronde11.txt.
- Ekspektasi di Termux Rin setelah instal: 125/125 PASS (97 + 28).

---

## Ronde 11b — Worker pool concurrency kolektor market-volume (2026-10-12 ~19:00 WIB)

Latar: Rin menjalankan menu 15 pada CA BONK (Dz9mQ9Nz...iW8Mbonk, sampel backtest
pertama) — 556/1400 tx gagal jaringan dan proses tampak "terhenti". Analisis π:
kolektor berjalan SEQUENTIAL; tiap timeout (25-60 dtk, termasuk retry internal
4x di rpc()) memblokir seluruh antrean — head-of-line blocking. Bukan murni
masalah rate limit.

Solusi (permintaan Rin): worker pool dengan batas concurrency seperti phase 8,
bisa diatur via config untuk nanti saat pakai API key asli.
- `collect_market_volume.js` v1.0.6: pool worker (`concurrency`, default 3,
  clamp 1-8, precedence flag CLI `--concurrency` > config `market_volume.concurrency`
  > default). `waitForSlot` bersifat GLOBAL (module-level) sehingga N worker
  tetap menghormati jeda antar-request — throughput tidak naik (risiko rate
  limit tidak bertambah), tetapi satu request timeout tidak lagi menghentikan
  semuanya. Paruh window tetap benar karena berbasis index asli (dibawa saat retry).
- Setting tercetak di banner (`worker 3`) dan tersimpan di `collector_config`.
- `merge_config.js`: deep-ensure `market_volume.concurrency` (aman untuk config
  yang sudah punya section market_volume).
- Test: 4/4 baru (pool: agregat identik 1 vs 3 worker, paruh benar walau
  completion acak, retry dalam pool, precedence+clamp) + update 1 test default
  lama. `npm test`: **158/158 PASS**.

---

## Ronde 12 — Keputusan Rin atas daftar perbaikan backtest (2026-10-13)

Keputusan Rin: A1/A2/B1 ikut saran π; B2 opsi B (exclude wallet CEX, registry
dikirim Rin); C1–C4 DITUNDA sampai sampel ≥10 CA; D1 opsi (c) (pindahkan
retention+conviction keluar dari holder); E dibiarkan.

- **A1** (phase5+phase12): POOL_COIN_CREATOR selalu confidence LOW (pool creator
  ≠ token deployer) + prioritas terakhir setelah METADATA_CREATOR/DAS_AUTHORITY;
  phase12 CREATOR_SELL hanya FAIL bila atribusi MEDIUM+ (LOW → WARN jujur).
  Kasus BONK (AVOID palsu) teratasi. Test 3/3.
- **A2** (phase4): `knownDexPool()` — pool tanpa identitas DEX/program dikenal
  tidak masuk significant_pools; jumlah terfilter dicatat
  (`unknown_dex_pools_filtered`). Test 1/1.
- **B1** (phase9): guard kredibilitas likuiditas untuk SPR-05/LTR-01/LTR-04 —
  bila pool < 1% dari volume SELL teramati (config `evaluation_guards.
  liquidity_credibility_ratio`, default 0.01) → INSUFFICIENT_DATA dengan alasan
  jujur; rasio mentah tetap dipublikasikan sebagai diagnostik
  (`metric.liquidity_credibility`). phase9_rules.json TIDAK disentuh (terkunci).
  Kasus 9cRC (263x) dan 39ah (12 miliar x) menjadi INSUFFICIENT; BONK & BQAe
  tidak berubah. Test 4/4.
- **B2** (baru): `Script/cex_registry.js` + `Data/cex_registry.json` (171 alamat,
  17 label, dari Rin; policy eksplisit, fail-soft bila file tak ada). Phase 4:
  klasifikasi CEX_WALLET (HIGH) sebelum probe RPC → otomatis excluded dari
  adjusted_confirmed_normal + kohort sendiri. Kolektor market-volume: CEX
  dikecualikan dari ranking top_sellers/top_buyers (totals tidak diubah) +
  disclosure. Phase 9 TCR-01/02: filter defensif untuk market-volume.json lama.
  Test 3/3.
- **D1** (db_conviction_metrics): retention+conviction keluar dari
  holder_distribution (skor tak lagi diubah DB di dimensi itu);
  coordinated_sell/fast_exit/negative_conviction tetap di risk_findings.
  2 test lama Opsi B diupdate ke perilaku baru. Test 2/2.
- `merge_config.js`: section baru `evaluation_guards` (idempoten).
- `npm test`: **171/171 PASS** (13 test baru ronde 12).

---

## Update DB wallet (2026-10-13)

Rin mengirim `database-wallet_0_jl8e.json`: 1143 wallet (0 duplikat, 0 address
invalid), 259 wallet baru. Emoji dipindah dari dalam `name` ke field khusus
`emoji` — AMAN karena `extractModifiers` membaca gabungan `name`+`emoji`
(malahan lebih bersih). Distribusi emoji baru: 🚫 3, 🚩 22, 💚 71, ⭐ 9.
541 wallet tanpa group → otomatis DEFAULT (bobot 1) via `normalizeWalletRoles`,
konsisten dengan ronde 11. `db_total_wallets` 884→1143 (default +
`merge_config.js` kini menyinkronkan otomatis dari jumlah aktual file agar
penyebut penetrasi selalu jujur). Tersinkron ke `Data/database-wallet.json`.
`npm test`: 171/171 PASS.

---

## Diagnostik "gagal jaringan" (2026-10-13)

Pertanyaan Rin: angka "gagal jaringan" di menu 15 (mis. 388/400) — dari RPC
atau jaringan HP? Temuan: label tersebut menutupi SEMUA kegagalan (jaringan
HP/DNS, timeout, 429 persisten, HTTP/RPC error) dan alasan per-signature
DIBUANG (`retryable.push({sig, idx})` tanpa reason) — tidak ada cara tahu
dari angka itu saja.

Perbaikan (kolektor v1.0.7): alasan tiap kegagalan kini disimpan,
dinormalisasi (`HTTP_429_rate_limited`, `timeout_aborted`,
`network_*`, `HTTP_*`, `RPC_*`), diagregasi di
`coverage.retryable_reasons`, dan 5 teratas dicetak di ringkasan akhir.
Run berikutnya akan menjawab pasti: dominan `network_*` = jaringan HP;
dominan `timeout_aborted`/`HTTP_429` = sisi RPC/limit.
`npm test`: 172/172 PASS.

---

## Ronde 13 — Throttle global Helius RPC (2026-10-13)

Pertanyaan Rin: apakah script sudah memenuhi limit 10 request/detik Helius
trial, dan bagaimana pemakaian API Helius lainnya. Ia mengirim pola resmi
dokumentasi Helius (throttle ~10/dtk + retry exponential backoff + jitter
saat 429) dan meminta diterapkan ke SEMUA kode + bisa di-setting di
`config.json` untuk API key asli nanti.

Hasil audit: retry exponential backoff SUDAH ada di semua helper (phase 1-7,
phase 8, kedua kolektor). Yang BELUM ada: jeda preventif antar-request di
phase 1-7 — request dikirim beruntun tanpa pacing, sehingga burst bisa
menembus 10/dtk dan hanya mengandalkan retry SETELAH kena 429. Phase 8
(180ms) dan kolektor (funding_graph 180ms, market_volume 300ms) sudah punya
pacing sendiri.

Implementasi:
- Modul baru `Script/rpc_throttle.js`: SATU slot global per proses Node
  (`takeSlot()`), jadi worker pool / burst loop tidak bisa menembus budget
  meski concurrency naik. Fungsi `backoffMs()` = pola resmi dokumentasi:
  `delay * (0.75 + Math.random() * 0.5)`, digandakan tiap percobaan,
  dibatasi `max_delay_ms`, menghormati header `Retry-After`.
  `delayUntil()` untuk shared cooldown 429 phase 8.
- Phase 1-7: tiap helper `requestJson`/`req()` kini memanggil
  `throttle.configure(config)` + `await throttle.takeSlot()` sebelum
  `fetch()`; backoff 429/5xx dan network error diseragamkan lewat
  `backoffMs()` (eksponensial + jitter + Retry-After). Tracker
  rate-limit tiap phase (phase 3/4/5/6/7) tidak diubah.
- Phase 8: `waitForRequestSlot()` kini lewat slot global (interval tetap
  `phase8.min_request_interval_ms`, default 180); `globalCooldownUntil`
  tetap dikelola di sini via `delayUntil()`.
- Kolektor funding_graph & market_volume: `waitForSlot` lokal diganti
  `throttle.takeSlot(minIntervalMs)` — interval tetap dari config
  masing-masing (flag CLI > config > bawaan); retry 429 kini backoff+jitter.
- Config baru `rpc_throttle` (di `Config/config.json.example` +
  deep-ensure `merge_config.js`, tanpa menyentuh `helius.api_key`):
  `min_interval_ms: 110` (~9 req/dtk, aman < 10/dtk),
  `max_delay_ms: 30000`, `retryable_statuses: [408,429,500,502,503,504]`.
  Untuk API key asli: turunkan `min_interval_ms` bila ingin lebih cepat,
  naikkan bila masih kena 429. Modul ber-interval sendiri (phase8,
  market_volume, funding_graph) tetap override.
- 12 test baru `tests/rpc_throttle.test.js`: configure/default,
  enforcement jeda, slot global antar-pemanggil, `delayUntil`, parse
  Retry-After, rentang jitter backoff, cap `max_delay_ms`, dan uji pola
  dokumentasi (6 request beruntun >= 550ms, tidak menembus ~10/dtk).
- `npm test`: 184/184 PASS (172 lama + 12 baru). Rule/threshold Phase 9
  tidak disentuh.

---

## Ronde 13b — Tampilan progres menu 15 (2026-10-13)

Permintaan Rin: tampilan terminal menu 15 terlalu simpel (`200/1500
transaksi (gagal jaringan: 190)`) — tidak terlihat apakah proses berjalan
atau terhenti, tidak ada info hasil per batch seperti phase lain.

Perbaikan (`Script/collect_market_volume.js`):
- Fungsi murni baru (bisa di-unit-test, diekspor): `progressBar(done,
  total)` (bar 30 kolom `█`/`░` + persen), `formatScanProgress()` (bar +
  `done/total tx` + `ok`/`gagal`/`skip` + kecepatan `tx/dtk` + `ETA`),
  `formatRetryProgress()` untuk retry pass.
- `collectSignatures()` kini memberi argumen `info` ke callback
  `onProgress`: `{ ok, permanent, elapsedMs }` tiap item (pass 0), dan
  `{ passDone, passTotal, passComplete }` tiap 50 item + tiap akhir retry
  pass. Callback lama yang tak memakai `info` tetap aman (argumen tambahan
  diabaikan).
- Baris progres kini dicetak tiap 100 tx (sebelumnya tiap 200), contoh:
  `[██████████████░░░░░░░░░░░░░░░░]  47% | 700/1500 tx | ok 612 | gagal 84 | skip 4 | 11.7 tx/dtk | ETA ~69 dtk`
  Retry pass: `↻ retry 1 [████...] 40% | 60/150 | pulih 12`, dan tetap
  ada baris penutup `↻ retry pass 1 selesai: pulih 34 total, tersisa 116`.
  Kecepatan tx/dtk + ETA menjawab "berjalan vs terhenti".
- 7 test baru `tests/collect_progress_bar.test.js` (bar 0/50/100%,
  format baris, ETA menit, info callback pass 0 + retry pass).
- `npm test`: 191/191 PASS. Tidak ada perubahan logika pengumpulan data.

---

## Ronde 13c — Bug RPC_-32015: transaksi v1 gagal deterministik (2026-10-14)

Sorotan Rin dari run menu 15 (mint EuHFv…HsXW, 1000 tx): retry pass
memulihkan 0 dari 219 yang gagal; `Penyebab gagal: RPC_-32015(437),
network_fetch_failed(1)`.

Diagnosis (terverifikasi ke dokumentasi Helius): `-32015` = "Transaction
version (1) is not supported by the requesting client" — server menolak
karena request kita mendeklarasikan `maxSupportedTransactionVersion: 0`
sementara 219 signature itu adalah transaksi **v1**. Kegagalan ini
DETERMINISTIK: tiap percobaan (4x di `rpc()` + 1 retry pass = 437 hitungan)
gagal dengan error yang sama. Retry hanya menolong kegagalan transient
(429/timeout/jaringan), jadi 0 pulih adalah perilaku yang tepat untuk
error yang salah klasifikasi — bukan bug di mekanisme retry.

Perbaikan:
- `Script/collect_market_volume.js` (`fetchAndClassify`) dan
  `Script/collect_funding_graph.js` (`collectForWallet`): 
  `maxSupportedTransactionVersion: 0` → `1` (sesuai anjuran dok. Helius;
  phase 5 & phase 6 sudah memakai 1 — kolektor yang tertinggal).
  Parser (`classifyTxFlow`, `extractInboundTransfers`) hanya membaca
  `meta` balances dan `accountKeys` (sudah handle format string maupun
  objek `{pubkey}` khas v1) — version-agnostic, aman.
- `collect_funding_graph.js` mengekspor `GET_TRANSACTION_OPTS` untuk
  test regresi; VERSION 1.0.0→1.0.1, market_volume 1.0.6→1.0.8 (1.0.7 =
  diagnostik retryable_reasons).
- Dampak pada run Rin: 219/1000 (21.9%) yang gagal itu BUKAN masalah
  jaringan/limit — setelah patch, signature v1 akan ter-parse normal dan
  angka "gagal jaringan" seharusnya anjlok. Label "gagal jaringan" untuk
  RPC error memang menyesatkan; `retryable_reasons` (v1.0.7) sudah
  memisahkannya.
- 4 test baru `tests/collect_v1_tx.test.js`: param getTransaction = 1 di
  kedua kolektor, fixture tx bentuk v1 terklasifikasi BUY dengan benar,
  `fetchAndClassify` status ok untuk tx v1.
- `npm test`: 195/195 PASS.

---

## Fix merge_config fresh-clone (2026-10-14, belum terdokumentasi sebelumnya)

Masalah: pada clone/setup baru, `Config/config.json` belum ada sehingga
`merge_config.js` crash `ENOENT` saat `readFileSync` — langkah setup dilewati
pengguna yang langsung menjalankan tanpa config.

Perbaikan (`merge_config.js`, ada di `sti_upload` maupun tree bersih):
- Bila `Config/config.json` belum ada, seed dari `Config/config.json.example`
  (atau objek kosong bila example pun tidak ada), lalu lanjutkan deep-ensure
  seperti biasa. Idempoten; `helius.api_key` tetap tidak disentuh.
- Perilaku tercatat di console: `Config/config.json (seeded from example)`.

## Publikasi repo publik GitHub (2026-10-14)

Permintaan Rin 2026-10-14 15:32 WIB: push script ke repo publik yang dibuatnya
sendiri — `Nameis429/-STI-Solana-Token-Intelligence` (branch `main`) — dengan
syarat: hilangkan semua hal sensitif (API dsb.), beri note untuk pengguna,
hilangkan dokumentasi, test, dan hasil output; script harus terlihat clean
tanpa tanda-tanda pengembangan.

Tree bersih dibangun di `~/workspace/sti_clean/` (36 file, hasil verifikasi
remote 2026-10-14):
- Root: `.gitignore`, `README.md` (English), `main.js`, `merge_config.js`,
  `package.json` (dibersihkan: name/version/description, script `start`)
- `Script/` — 26 file (semua phase, kedua kolektor, `rpc_throttle.js`,
  `db_conviction_metrics.js`, `cex_registry.js`, `relationship_annotator.js`)
- `Config/` — `config.json.example` (placeholder saja) +
  `phase9_rules.json` (katalog 18 rule yang terkunci; **sempat terlewat saat
  build pertama, ditambahkan 2026-10-14 setelah Rin menanyakan** —
  commit `3a060b69`)
- `Data/` — `cex_registry.json` (apa adanya, `_meta` netral) +
  `database-wallet.example.json` (format saja, lihat bawah)

Dihilangkan dari repo: `Docs/`, `LAPORAN_AUDIT...`, `tests/`, `Output/`,
`Archive/`, `RegressionData/`, `MULAI_CEPAT.md`, README lama, dan semua
komentar "tanda pengembangan" di script + `merge_config.js` (referensi
ronde/nama Rin/tanggal keputusan → penjelasan teknis biasa). Perhatian:
regex perapat spasi ganda sempat merusak alignment banner UI — dibatalkan;
pembersihan diulang hanya pada komentar tanpa menyentuh whitespace.

Sanitasi wallet DB (keputusan Rin): `Data/database-wallet.json` yang
disanitasi (hanya field fungsional, 96KB, 1143 wallet) **dihapus total dari
repo** setelah π menyampaikan bahwa daftar pantauan pribadi Rin akan terlihat
publik. Yang tersisa: `database-wallet.example.json` (2 entry contoh format)
+ section "Wallet database (manual)" di README. `merge_config.js` membuatkan
file kosong `[]` otomatis bila belum ada.
`Data/social_signals.example.json` juga dihapus (fitur belum dikembangkan)
+ mention di README dihapus. Keduanya di-`.gitignore` agar data pribadi
pengguna tetap lokal.

Empat adaptasi fungsional kecil khusus tree repo (terverifikasi tidak
mengubah logika analisis; diff fungsional vs `sti_upload` sudah diperiksa
satu per satu):
1. `merge_config.js` — buat `Data/database-wallet.json` kosong (`[]`) bila
   belum ada, agar Phase 7 tetap jalan (0 match → `INSUFFICIENT_DATA` jujur,
   bukan crash `DATABASE_WALLET_NOT_FOUND_OR_INVALID`).
2. `db_total_wallets` default `1143` → `0` (di `merge_config.js`,
   `Config/config.json.example`, dan `DEFAULTS`
   `db_conviction_metrics.js`); sinkronisasi otomatis dari jumlah aktual
   file tetap berjalan.
3. `share_of_db`: pengaman pembagian-nol
   (`cfg.db_total_wallets > 0 ? ... : null`).
4. `package.json` diganti versi publik (name/version/description,
   script `start`).

Riwayat push (semua via GitHub MCP, argumen CLI dibatasi 128KB/string
sehingga push awal dibagi 9 batch/commit):
- 9 commit awal: `8ecb3262` (initial) … `dcbf1ec9` (batch 9) — isi repo.
- `551caa0f` — update: hapus DB + social example, note format manual.
- `3da4d79f` — delete `Data/database-wallet.json`.
- `68faf20e` — delete `Data/social_signals.example.json`.
- `3a060b69` — tambah `Config/phase9_rules.json`.

Pelajaran: checklist file wajib sebelum push publik — `phase9_rules.json`
hampir tertinggal karena bukan bagian dari pola "config vs data" yang biasa
dicek. Untuk publikasi berikutnya: diff daftar file tree bersih vs
`sti_upload` yang relevan (bukan `Archive/`/`Output/`/`tests/`), pastikan
setiap file fungsional ikut.

---

## Ronde 14 — Report HTML khusus wallet DB + nilai standar (2026-10-20)

Permintaan Rin (dari sesi tanya-jawab atas analisis batch 1 realtime scan,
22 CA): report HTML khusus wallet DB yang terpisah, dibuat di menu 13.
Definisi Rin: total skor DB per CA = Σ nilai positif − Σ nilai negatif dari
wallet DB yang match; nilai standar = rata-rata total dari CA acak batch 1;
warna: di atas standar HIJAU, di bawah MERAH, ±5% di sekitar standar
KUNING. Rin memilih varian pita: **±5% dari rentang distribusi**
(bukan ±5% dari standar — standar batch 1 = +0,9545 sehingga pita ±5%
darinya hanya 0,91–1,00, tidak bermakna).

Komponen baru:
- `Script/compute_db_benchmark.js` — menghitung benchmark dari folder
  Output mana pun (`--output-root`, `--out`). Total per CA memakai
  `database.total_database_weight` phase 7 (role + modifier emoji) persis.
  Hasil batch 1 tersimpan di `Data/db_benchmark.json`: **n=22,
  standar +0,9545, median 2, min −28 (LouLou), max +19 (Normie),
  rentang 47, pita kuning −1,3955 s.d. +3,3045** (band_width 2,35).
  Klasifikasi batch 1: 10 HIJAU, 5 KUNING (total 2,2,2,2,0), 7 MERAH.
  File memuat `per_ca` lengkap sebagai provenance; jalankan ulang script
  ini setelah batch baru untuk memperbarui standar.
- `Script/wallet_db_report.js` — generator `wallet-db-report.html`
  (terpisah dari `report.html`), presentasi murni dari phase7-result.json:
  banner total skor berwarna + rincian Σ positif/negatif; tabel wallet DB
  yang HOLD (saldo, % supply, rank holder, pertama akuisisi, durasi hold
  = akuisisi pertama → interaksi terakhir); tabel wallet DB yang pernah
  membeli/menerima (buy/receive count, status kini); tabel 25 wallet DB
  paling aktif (buy, sell, flow in/receive, flow out, total event, jumlah
  transaksi). Benchmark tidak ada → label jujur "STANDAR BELUM TERSEDIA"
  (abu-abu), bukan warna tebakan.
- `main.js` menu 13: setelah report utama, wallet DB report dibuat juga
  (try/catch terpisah — kegagalannya tidak menggagalkan report utama);
  label menu diperbarui. Bisa juga standalone:
  `node Script/wallet_db_report.js --mint <mint>`.
- 9 test baru `tests/ronde14_wallet_db_report.test.js` (aritmetika total,
  tepi pita klasifikasi, benchmark dari fixture, format durasi, HTML
  dengan/tanpa benchmark, konsistensi db_benchmark.json batch 1).
  `npm test`: **207/207 PASS**.
- Contoh terverifikasi dari data batch 1: DOPE total +8 → HIJAU
  ("DI ATAS STANDAR"); LouLou total −28 → MERAH ("DI BAWAH STANDAR").

Catatan desain: total skor DB murni akumulasi bobot wallet yang
bersentuhan — TIDAK membedakan perilaku (hold vs jual). Rincian perilaku
tetap di tabel report dan di adjustment Phase 11. Report ini tidak
mengubah skor Phase 11 sama sekali.

Catatan kemasan ZIP ronde 14: paket menyertakan `Output/8DXq.../` (5,6MB,
satu-satunya folder Output yang disertakan) karena `tests/p0-runtime`
membaca fixture itu — tanpa folder tersebut, ekstraksi bersih gagal 2 test
(205/207). Dengan folder itu: verifikasi ekstraksi bersih **207/207 PASS**
dan `wallet_db_report.js` terbukti jalan end-to-end pada token acuan
(total skor DB 8DXq jatuh di pita KUNING — "SEKITAR STANDAR").

---

## Ronde 15 — P0: Gerbang cakupan skor Phase 11 (2026-10-20)

Pelaksanaan tingkat P0 dari Roadmap 2026-10-20 (disetujui Rin; dasar
kesepakatan yang sama: acuan uji live = Baton, 8DXq = fixture backtest
internal, skor acuan terkunci 53 tidak berubah).

Masalah yang diperbaiki (bukti batch 1): skor akhir direnormalisasi atas
dimensi yang tersedia sehingga data hilang menaikkan skor — korelasi
INSUFFICIENT_DATA vs skor +0,65; LouLou meraih 81 "Sangat kuat" dari data
paling rusak (risk_findings unavailable + 11/18 rule INSUFFICIENT_DATA).

Implementasi (`Script/phase11_final_report.js`):
- Fungsi murni baru `evaluateScoreGate` + `resolveScoreGateConfig` +
  `loadScoreGateSection`. Formula skor TIDAK berubah sama sekali.
- Gerbang aktif bila: dimensi `risk_findings` tidak tersedia, ATAU rasio
  rule Phase 9 INSUFFICIENT_DATA > ambang (bawaan **1/3**, dari
  `Config/config.json` section `score_gate`; tepat 1/3 TIDAK kena —
  pembanding memakai epsilon agar 6/18 aman).
- Bila aktif: `summary.classification` diplafon ke **tier 3** ("Sedang"),
  skor ditandai PROVISIONAL (`summary.score_gate` memuat alasan, rasio,
  klasifikasi sebelum/sesudah), headline menjadi
  "PROVISIONAL — <label> — <skor>/100", dan catatan keterbatasan ditambah.
  Angka `final_quality_score` tetap mentah apa adanya.
- Konsol Phase 11 mencetak baris STATUS PROVISIONAL + RULE EVAL.
- Report HTML (`generate_html_report.js`): headline selalu bertiga —
  skor + confidence + % rule terevaluasi — dan badge PROVISIONAL tampil
  bila gerbang aktif. Report lama tanpa `score_gate` tetap aman.

Config: section baru `score_gate` {enabled, max_insufficient_ratio,
tier_cap} di `config.json.example` + `merge_config.js` (deep-ensure).

Verifikasi pada fixture nyata:
- 8DXq (fixture terkunci): skor tetap **53**; gate tercatat applied
  (14/18 INSUFFICIENT pada fixture itu) tapi tier sudah 3 — tidak bergeser.
- LouLou: skor tetap 81, tier 5 → diplafon 3, PROVISIONAL (dua alasan).
- DOPE: gate tidak aktif (INSUFFICIENT 4/18, risk tersedia) — tier 4 utuh.

11 test baru `tests/ronde15_p0_gate.test.js`. `npm test`: **218/218 PASS**;
verifikasi ekstraksi bersih 218/218.

---

## Ronde 16 — Menu utama ringkas + mode B & C (2026-10-20)

Permintaan Rin (dengan contoh layout persis dari Rin): tampilan menu
terminal selama ini dobel — daftar phase 01–15 lalu 00/13/14/15 tercetak
lagi di bawah. Itu sisa tambalan: menu bawaan paket hanya 01–12 + 00;
menu 13/14/15 ditambahkan ronde demi ronde sebagai handler khusus tanpa
membersihkan daftar lama.

Perubahan (`main.js` saja, tidak ada logika phase yang diubah):
- **Banner satu daftar:** 01–12 phase, 13 report, 14/15 kolektor, lalu
  mode huruf. Tidak ada lagi pengulangan.
- **A** = Jalankan seluruh phase 1–12 (pengganti 00; "00" lama tetap
  diterima sebagai alias).
- **B** = Jalankan Phase 14 & 15 sekaligus (kolektor opsional), memakai
  pola scan-context/run_id yang sama dengan phase manual; di akhir ada
  petunjuk lanjutan (phase 09 lalu 11 agar sidecar terbaca).
- **C** = **Scan Ulang**: untuk CA yang sudah punya scan-context.
  Urutan 14 → 15 → 03–12; phase 01–02 dipakai ulang dari scan sebelumnya
  (identitas & authority statis). run_id lama dipertahankan agar validasi
  integritas Phase 11 koheren; context diperbarui `mode: 'rescan'` +
  `rescanned_at`. Peringatan ditampilkan sebelum jalan: hasil phase yang
  diulang MENIMPA hasil lama (arsip riwayat otomatis = roadmap P2, belum
  dibangun). CA tanpa scan-context ditolak dengan arahan ke menu A.
- **V** = Set API key Helius (menjalankan `Script/set_key.js` sebagai
  child, pola jeda readline yang sama seperti phase).
- Menu A kini juga membuat wallet DB report setelah report utama
  (menyamakan dengan menu 13; sebelumnya pipeline hanya report utama).

Verifikasi: menu dirender persis layout Rin; uji interaktif (expect/PTY):
C pada CA belum pernah di-scan → penolakan benar; B dengan CA tidak valid
→ ditolak; V dengan key kosong → dibatalkan dan kembali ke menu; X keluar
bersih. `npm test`: **218/218 PASS** (tidak ada test yang mengunci
tampilan menu; tidak ada regresi).

---

## Ronde 17 — P1: fee_utility eksplisit + skor ganda (2026-10-21)

### fee_utility: BUKAN bug wiring — gerbang kelayakan yang disengaja

Penelusuran phase 6 → 10 → 11 menemukan kontraknya utuh tapi mati:
Phase 6 MENGHASILKAN skor fee (−10..+10 via `scoreFeeEconomics`, hanya
dari komponen terverifikasi) dan Phase 11 membacanya — tetapi hanya
memasukkannya ke skor bila `project_utility_verified === true`, yang
oleh Phase 6 didefinisikan sempit sebagai utilitas PROTOKOL terverifikasi
saja. Untuk token pump.fun syarat itu praktis tidak pernah terpenuhi
(23/23 scan: batch 1 + Baton; klasifikasi terbanyak
FEE_ROUTING_ONLY_PURPOSE_UNKNOWN, skor sumber 0 = NO_VERIFIED_FEE_COMPONENTS).
Akibatnya dimensi berbobot 10 ini selalu hilang diam-diam dari
denominator. Bukti negatif terverifikasi (ekstraksi creator, −4 poin di
Phase 6) juga ikut terbuang oleh gerbang yang sama.

Menghubungkan skor itu paksa BUKAN perbaikan wiring — itu perubahan
model: skor 0 Phase 6 ambigu (netral vs tanpa bukti), dan memasukkannya
akan menyeret turun semua skor token pump.fun. Wilayah kalibrasi P5;
keputusan Rin, idealnya dengan data outcome P4. Maka P1 diselesaikan
sesuai mandat roadmap sebagai DEKLARASI eksplisit:

- `summary.fee_utility_status`: status USED/NOT_USED + klasifikasi
  Phase 6 + skor sumber + status bukti (buyback/burn, ekstraksi creator,
  manfaat holder) — bukti tercatat sebagai bukti, bukan skor.
- Alasan dimensi di `score_breakdown` kini menyebut klasifikasi dan
  skor sumber; `limitations` menambah satu baris eksplisit bila
  dimensi tidak dipakai.
- Report HTML menampilkan baris "Dimensi fee_utility tidak dipakai …"
  di bawah headline; konsol Phase 11 mencetak baris FEE UTILITY.

### Skor ganda dengan/tanpa DB

- `scoreDimensions` kini menyimpan `details.pre_db_score` per dimensi
  (skor pra-adjustment EKSAK — rekonstruksi dari total_points tidak
  cukup karena clamp 0/100 menelan selisih; terbukti di Baton: basis
  risk 1,0 + adj −2,4 → 0, rekonstruksi akan menebak 2,4).
- `summary.score_variants`: `with_db` (skor resmi, tak berubah),
  `without_db` (denominator & bobot identik, dari pre_db_score),
  `db_delta_points` + `db_delta_raw`. Gerbang P0 hanya menjaga skor resmi.
- Tampil di headline HTML ("Dua sumbu sinyal (P1): …") dan konsol
  Phase 11 (baris SKOR TANPA DB).

Verifikasi data nyata (rebuild buildReport): **8DXq tetap 53**;
**Baton: with_db 60 (raw 59,69) = skor resmi semula; without_db 60
(raw 60,00); delta 0 / raw −0,31** — adjustment DB Baton (−2,4 di
risk_findings) ternyata terserap clamp lantai 0 sehingga nyaris tak
mengubah skor akhir; fee Baton NOT_USED dengan buyback_burn_verified
true tercatat. 4 test baru `tests/ronde17_p1_dual_score.test.js`
(termasuk fabrikasi adjustment −15 ter-clamp: with 71 vs without 75).
`npm test`: **222/222 PASS**.

---

## Ronde 18 — Phase 10 & 11 tanpa menu interaktif (2026-10-21)

Permintaan Rin: setelah scan selesai, Phase 10 dan 11 masih membuka
daftar isi (DETAIL MENU) yang harus dipilih manual — tidak seperti phase
lain yang langsung selesai di ringkasan. Detail cukup dibaca dari file
JSON.

Perubahan:
- **Phase 10** (`phase10_scoring_engine.js`): `runMenu()` dan
  `printDetails()` dicabut; `main()` berakhir di `printSummary()`
  (status rule, coverage, temuan terskor tertinggi, path file hasil).
  Import readline dibuang.
- **Phase 11** (`phase11_final_report.js`): `menu()` dan `showDetail()`
  dicabut; `main()` selalu `showMain()` lalu selesai (flag `--no-menu`
  lama tetap diterima, kini tanpa efek). Daftar isi DETAIL MENU di akhir
  `showMain()` diganti satu baris penutup: "Detail lengkap: lihat file
  phase11-result.json pada folder Output token ini." Import readline
  dibuang. Komentar usang di `main.js` soal "menu Phase 10" diperbarui.
- Hasil JSON kedua phase TIDAK berubah sama sekali — ini murni tampilan
  terminal.

Verifikasi: uji PTY (expect) pada fixture 8DXq — kondisi TTY asli yang
dulu memicu menu — kedua phase mencetak ringkasan lalu **keluar sendiri**
tanpa prompt "Pilih menu:". `npm test`: **222/222 PASS**.

---

## Ronde 19 — P1 ditutup: fee_utility DIAKTIFKAN, model M2 (2026-10-21)

Keputusan Rin (2026-10-21): aktifkan fee_utility dengan model netral M2.
Didahului simulasi π atas 23 scan yang ada (tanpa mengubah paket):
gerbang lama (project_utility_verified saja, peta ×10) meloloskan 0/23;
skor fee Phase 6 = 0 di 23/23 (nol variasi); eligibility diperluas
meloloskan 5 (Aloooong, hi, DUO, DIKSHIT, Baton — semuanya hanya via
bukti buyback/burn). Model ×10 menghukum 5 token itu −6..−8 poin hanya
karena bukti komponen absen (ditolak); M2 menggeser −1..−2 poin.

Implementasi (`Script/phase11_final_report.js`):
- Eligibility M2: ≥1 bukti penggunaan fee terverifikasi — utilitas
  protokol / manfaat holder / buyback-burn / ekstraksi creator — DAN
  skor sumber Phase 6 tersedia.
- Pemetaan: dimensi = `clamp(50 + 5×skor)` (skor −10..10 → 0..100,
  titik netral 50). Sinyal negatif kini bisa masuk secara terpetakan
  (ekstraksi creator terverifikasi skor −4 → dimensi 30).
- Tanpa bukti terverifikasi: dimensi tetap dinyatakan TIDAK DIPAKAI
  (deklarasi Ronde 17 dipertahankan penuh untuk kasus itu).
- `fee_utility_status` naik versi `p1-fee-utility-status-v2`: field
  `model` + `verified_uses`; konsol Phase 11 mencetak baris
  "FEE UTILITY: DIPAKAI (model M2)" bila aktif.
- Formula dimensi lain, gerbang P0, dan skor ganda tidak berubah.

Verifikasi: 4 test baru `tests/ronde19_p1_fee_m2.test.js` (netral 50 /
ekstraksi 30 / utilitas 80 / tanpa bukti tetap NOT_USED); test ronde 17
disesuaikan (fixture tanpa bukti → dunia NOT_USED tetap utuh).
Data nyata: **Baton scan ulang 63 → 61** (fee 50; varian 61/62) —
persis angka simulasi pra-aktivasi; **8DXq tetap 53** (fee NOT_USED).
`npm test`: **226/226 PASS**.

Catatan ke depan: M2 adalah pemetaan baseline netral, BUKAN kalibrasi.
Karena skor fee 23/23 bernilai 0, dimensi ini untuk sementara berperilaku
sebagai konstanta 50 bagi token eligible — nilai diskriminatifnya
bergantung pada pendalaman bukti Phase 6 (kandidat tercatat di roadmap).

---

## Ronde 20 — P2: arsip riwayat scan + perbandingan antar-scan (2026-10-21)

Menutup item P2 roadmap. Verifikasi cukup dengan `npm test` + dua sampel
nyata Baton (keputusan Rin) — tanpa scan ulang khusus.

Baru:
- `Script/scan_history.js` — `archivePreviousRun(mintDir)`: sebelum
  pipeline (menu A / C) menulis ulang `Output/<mint>`, seluruh hasil run
  sebelumnya dipindah ke `Output/<mint>/history/<stempel-run>/` (nama
  dari scan-context run lama: rescanned_at || started_at) +
  `ARCHIVE_INFO.json`. `liquidity_history.jsonl` SENGAJA tetap di tempat
  (deret utuh LTR-02/03). Scan pertama / folder kosong = no-op.
- `main.js` — langkah arsip di `runAll` & `runRescan` (helper
  `archiveStep`); bila arsip GAGAL, run DIBATALKAN agar satu-satunya
  bukti scan lama tidak tertimpa tanpa arsip. Teks peringatan mode C
  diperbarui (tidak lagi "menimpa"; kini "diarsipkan").
- `Script/scan_compare.js` — `buildComparison(mintDir)`: ringkasan run
  kini vs arsip terbaru → delta skor (dengan & tanpa DB), confidence,
  % rule terevaluasi, TRIGGERED/INSUFFICIENT, dimensi risk_findings,
  DB (match, total bobot via computeTotalFromMatches yang sama dengan
  benchmark, retensi), Phase 8 (scanned/complete), daftar rule berubah
  status, perubahan himpunan pool (dari phase4 kedua run), dan PENANDA
  kerangka yang disepakati: risiko turun + cakupan naik/tetap =
  PERBAIKAN KONSISTEN; risiko turun + cakupan turun = KEMUNGKINAN
  ARTEFAK SEPI; risiko naik = PERBURUKAN KONSISTEN/TERCAMPUR; tanpa
  perubahan risiko = STABIL; sinyal berlawanan = CAMPURAN. Catatan
  otomatis bila status fee_utility berubah antar-scan (efek model M2)
  atau himpunan pool berubah.
- Report HTML: section "Perbandingan Antar-Scan (P2)" (tabel delta +
  pill penanda + rule berubah + pool + catatan) tampil hanya bila ada
  arsip; `generateReportHTML` juga menulis `scan-comparison.json`.
  Kegagalan membaca arsip tidak pernah menggagalkan report utama.

Verifikasi:
- Rehearsal ujung-ke-ujung atas dua sampel Baton asli (layout Output
  direkonstruksi): delta keluaran modul PERSIS sama dengan analisis
  manual π (skor +3, triggered −1, insufficient −2, eval% +11,11,
  risk +9,01, DB matched +13, total DB +4, retensi −0,04, scanned +2,
  complete −8; rule berubah: LTR-02, LTR-03, TCR-02; pool 6 sama /
  0 baru / 15 hilang; penanda PERBAIKAN KONSISTEN). Langkah arsip
  diuji pada layout yang sama (17 file pindah, jsonl utuh 2 baris,
  arsip kedua no-op).
- 4 test baru `tests/ronde20_p2_history_compare.test.js` (arsip,
  konsisten, artefak sepi, tanpa arsip → null).
- `npm test`: **230/230 PASS**. Menu terverifikasi boot via PTY.
- Pemakaian live pertama: scan rutin berikutnya (arsip mulai berlaku
  sejak paket ini; scan-scan lama yang sudah tertimpa tidak bisa
  dipulihkan mundur).

---

## Ronde 21 — P3: coverage Phase 8 di bawah kuota (2026-10-21)

Menutup item P3 roadmap (tiga butir pekerjaan):

1. **Antrean prioritas bertier** (`Script/phase8_wallet_behavior_timeline.js`).
   `computeSelectionTier(sources)`: tier 1 = wallet DB-matched (Phase 7);
   tier 2 = top holder (Phase 3); tier 3 = terkait-creator (Phase 5
   creator/kandidat/penerima/relasi + penerima fee Phase 6); tier 4 =
   sisanya. Urutan dalam tier: role spesial DB (EARLY/WHALE/DEV/RUG-KOL)
   dulu, lalu holder DB aktif; tier 2 menurut peringkat holder menaik;
   penentu akhir alamat (deterministik). Tier ini TERPISAH dari priority
   HIGH/MEDIUM/LOW (kedalaman halaman tidak berubah). `selection_tier`
   tercatat per wallet (termasuk skipped_wallets) + hitungan per tier di
   `config.selection_tiers` & `wallet_selection`. Bila max_wallets
   memotong, yang terpotong kini selalu yang paling tidak menentukan.
2. **Preset retry sabar** (config `phase8.retry_preset`): 'standard'
   (bawaan) = perilaku lama persis (1 pass pemulihan, jeda
   `retry_429_pass_delay_ms`). 'patient' = 3 pass dengan jeda 3×/6×/12×
   jeda dasar, untuk run yang tidak buru-buru. `retry_passes` (1..5)
   dapat menimpa jumlah pass secara eksplisit. Summary kini memuat
   `retry_passes_executed`; `retry_still_rate_limited` dihitung sekali
   di akhir dari sisa antrean (identik untuk standard, benar untuk
   multi-pass). Kunci `retry_preset: "standard"` ditambahkan ke
   config.json + config.json.example.
3. **Peringatan urutan sidecar** (`main.js`): `warnMissingSidecars()`
   dipanggil di `runPhase` khusus Phase 9 (corong semua jalur: A, C,
   standalone) — mencetak peringatan jelas bila funding-graph.json /
   market-volume.json belum ada, menyebut rule yang akan gugur
   (CTR-02/03/05; TCR-01..04) dan anjuran menu B. Mencegah kasus "hi"
   batch 1 berulang. Sifatnya peringatan, bukan blokade.

Verifikasi: `collectCandidates` kini diekspor (main dijaga
`require.main === module`); 4 test baru `tests/ronde21_p3_coverage.test.js`
(urutan tier eksak pada fixture sintetis: DB-spesial > DB-holder >
DB-umum > top-holder peringkat > creator > downstream; multi-sumber
mengambil tier terbaik; preset & peringatan terpasang). Uji manual
collectCandidates atas input sintetis cocok. Menu boot via PTY normal.
`npm test`: **234/234 PASS**.

Catatan: kriteria selesai roadmap ("pada run yang kena limit, wallet
prioritas tetap berhistori lengkap; CTR-05 berpeluang terevaluasi")
hanya bisa dibuktikan pada run live berikutnya — antrean baru menjamin
wallet tier 1–3 dipindai PALING AWAL, sehingga merekalah yang selesai
sebelum kuota/limit memotong.


---

## Ronde 22 — Perbaikan crash Phase 10 di akhir proses (2026-10-21)

Dilaporkan Rin dari run live Batch 2 #1 (token
`8nnaeWCw8mUypcGAgbmSuzAT85uWx4UN12adDrMhXrGF`): Phase 10 mencetak
ringkasan lengkap, lalu crash:

```
TypeError: Cannot read properties of undefined (reading 'catch')
  at Script/phase10_scoring_engine.js:480  (main().catch(...))
```

**Akar masalah (dugaan Rin benar — pencabutan kode Ronde 18 kurang
bersih):** di Ronde 18 menu interaktif Phase 10 dicabut; `main()`
kehilangan kata kunci `async` karena tak ada lagi `await`, tetapi
pemanggil CLI di kaki file tetap `main().catch(...)`. `main()` versi
sinkron mengembalikan `undefined`, sehingga `.catch` melempar
TypeError. Urutan di dalam `main()` membuat dampaknya terbatas tapi
membingungkan: `phase10-result.json` sudah tertulis lengkap dan
ringkasan sudah tercetak SEBELUM crash — yang rusak hanya kode
keluar proses (1, bukan 0), sehingga pipeline `main.js` membacanya
sebagai "Phase 10 gagal" dan menawarkan [C]/[S].

**Kenapa lolos dari test & verifikasi Ronde 18:** seluruh test
mengimpor fungsi modul Phase 10 (`buildResult` dkk.) — tidak ada yang
menjalankan script-nya sebagai CLI. Bug hanya muncul di jalur
`require.main === module`.

**Perbaikan:** `function main()` → `async function main()` (satu kata;
selaras dengan phase lain). Pemindaian pola yang sama ke semua
script: hanya Phase 10 yang kena — phase lain `main`-nya async atau
ditangani try/catch sinkron (Phase 9).

**Test regresi baru:** `tests/ronde22_phase10_cli.test.js` — menjalankan
Phase 10 sebagai proses anak sungguhan di salinan sementara fixture
8DXq: wajib keluar kode 0, tanpa TypeError, hasil tertulis; plus uji
sumber bahwa `main()` async. Reproduksi sebelum perbaikan: exit 1 +
TypeError identik laporan. Sesudah perbaikan: exit 0, stderr bersih.
`npm test`: **236/236 PASS**. Hasil JSON Phase 10 tidak berubah.

**Data run Rin yang terlanjur kena:** tetap sah — tekan [C] di prompt
agar pipeline lanjut ke Phase 11/12/13; `phase10-result.json` pada run
itu utuh. Paket ronde 22 dipasang sebelum scan CA berikutnya.


---

## Ronde 23 — Menu B lanjut otomatis ke penilaian ulang 09–13 (2026-10-21)

Keputusan Rin (2026-10-21): menu B tidak lagi berhenti setelah kolektor
14+15. Sebelumnya kelanjutannya manual (09 → 10 → 11 → 12 → 13) dan
rawan terlewat — kasus "hi" batch 1 merusak 11 rule karena urutan
terlewat. Petunjuk lama yang dicetak B ("jalankan phase 09 lalu 11")
juga kurang lengkap: Phase 11 membaca hasil Phase 10, jadi 10 yang
lama akan dipakai bila tidak dijalankan ulang.

**Perilaku baru (`runCollectors` di `main.js`):**
1. Kolektor 14 + 15 berjalan seperti sebelumnya.
2. Bila hasil Phase 1–8 token sudah lengkap di folder Output, B lanjut
   otomatis: **09 → 10 → 11 → 12**, lalu **13** (HTML report + wallet
   DB report) bila Phase 11 berhasil — pola yang sama dengan penutup
   menu A/C. Kegagalan di tengah rantai memakai prompt [C]/[S] yang
   sama dengan pipeline lain.
3. Bila Phase 1–8 belum lengkap, B berhenti setelah kolektor dengan
   pesan yang menyebut phase yang belum ada + arahan menjalankan
   menu A dulu. Bila ada kolektor yang gagal, penilaian tetap
   dijalankan dengan catatan (Phase 9 akan memperingatkan sidecar
   yang hilang) — Phase 9–12 lokal, tidak menguras RPC.
4. **Tanpa pengarsipan P2 di B**: B adalah kelanjutan run yang sama
   (run_id scan-context dipakai ulang), bukan scan baru. Mengarsipkan
   akan memindahkan hasil Phase 1–8 ke history/ dan merusak rantai
   penilaiannya sendiri.
5. Teks banner B diperbarui mencerminkan perilaku baru; teks petunjuk
   menyesatkan lama dicabut.

**Verifikasi:** 4 test baru `tests/ronde23_menu_b_chain.test.js`
(bentuk sumber main.js: rantai persis [9,10,11,12], penjaga
kelengkapan 1–8, tanpa archiveStep, banner baru). Uji PTY/expect pada
salinan sementara (kolektor diganti stub keluar-0 agar uji berfokus
pada orkestrasi menu):
- Fixture 8DXq (Phase 1–8 lengkap): B → 14 → 15 → otomatis 09 → 10 →
  11 → 12 → report HTML + wallet DB report → "RINGKASAN MENU B"
  bersih, kembali ke menu, keluar normal.
- Mint tanpa scan utama: B berhenti setelah kolektor dengan pesan
  "Penilaian ulang (09-13) TIDAK dijalankan" + daftar phase yang
  belum ada.
`npm test`: **240/240 PASS**. Hasil JSON tiap phase tidak berubah —
ini murni perubahan orkestrasi menu.

## Ronde 24 — Menu C memakai arsip salinan, bukan pindah (2026-10-27)

Laporan Rin (2026-10-27, scan ulang Baton): menu C gagal di Phase 14
dengan `ERROR: phase8-result.json tidak ditemukan (atau mint ambigu)`,
dan file output "menghilang".

**Akar masalah (terverifikasi dari kode):** `runRescan` memanggil
`archiveStep` SEBELUM phase apa pun. Arsip P2 mode default memindahkan
semua file `Output/<mint>/` — termasuk `phase8-result.json` (input
Phase 14) dan `phase1/2-result.json` (input Phase 03) — ke
`history/<stempel>/`. Kolektor 14 lalu tidak menemukan inputnya,
padahal argumen mint sudah diteruskan dengan benar oleh `main.js`;
pesan "pakai argumen <mint>" menyesatkan. File tidak terhapus, hanya
pindah ke `history/`. Melanjutkan [C] akan merembet gagal (Phase 03
butuh phase1/2, Phase 08 butuh phase1–7). Scan ulang Baton #1 (21 Okt)
lolos karena masih memakai ronde 18, sebelum arsip P2 ada (ronde 20).

**Perbaikan (`Script/scan_history.js`, `main.js`):**
`archivePreviousRun` mendapat opsi `opts.copy` — arsip berupa salinan,
file asli tetap di tempat; `ARCHIVE_INFO.json` mencatat
`archive_mode: copy|move`. `runRescan` memakai
`archiveStep(scanDir, { copy: true })`; menu A tetap memakai mode
pindah karena meregenerasi semua inputnya dari nol. Dengan ini
`history/` tetap menyimpan run lama, sementara input lama tetap
terbaca selama scan ulang.

**Verifikasi:** 3 test baru
`tests/ronde24_mode_c_copy_archive.test.js` (salinan identik + file
asli tetap di tempat; mode pindah default tidak berubah; segmen
`runRescan` memakai copy, `runAll` tidak). `npm test`: **243/243
PASS** termasuk ekstraksi bersih dari ZIP. Pemulihan untuk run Baton
yang gagal: tekan [S], kembalikan isi `history/` terbaru ke root mint
(kecuali `ARCHIVE_INFO.json`), baru ulangi menu C dengan paket ini.

## Ronde 25 — Kalibrasi P5 final: SPR-02 → 30, CTR-02 → ambang 10 (2026-10-27)

Otorisasi bersyarat Rin (2026-10-25): implementasi HANYA untuk item yang
lolos hitung ulang final atas label formal 7 hari Batch 1 yang lengkap
(22/22). Dataset beku: `P5_calibration_dataset_2026-10-27.json`.
Label baru: SUPERCORE HIDUP rel_sol −70,7% (buruk STRICT via rel ≤ −70%),
Mimi HIDUP LEMAH −95,7% (buruk), PikaJew HIDUP LEMAH rel n/a (buruk via
status). Total: 13 buruk / 9 baik. 19 label lama terverifikasi TIDAK
bergeser vs dataset 25 Okt — perbaikan FORMAL FREEZE bekerja, 0 anomali.
Baton (di luar Batch 1): label 7 hari HIDUP, rel n/a — dilaporkan
terpisah, tidak masuk dataset kalibrasi.

**Gerbang (presisi ≥ 0,60 & recall di antara buruk yang terevaluasi
≥ 0,85):** C1 SPR-02 T=30 presisi 0,786 (11/14), recall 1,00 (11/11) —
LOLOS. C2 CTR-02 T=10 presisi 0,733 (11/15), recall 1,00 (11/11) — LOLOS.
Definisi buruk STRICT tidak berubah (MATI/RUG, HIDUP LEMAH, atau
rel_sol ≤ −70%); BROAD (tambah rel ≤ −50%) tetap identik dengan STRICT.
Catatan jujur: 2 buruk tak terevaluasi per rule tetap lolos dari sinyal
(C1: LouLou INSUFFICIENT_DATA, KWIF PROVISIONAL; C2: LouLou
NOT_TRIGGERED, hi INSUFFICIENT_DATA); EXFIL (SPR-02 raw 133, outcome
+290,1%) tetap menyala di semua ambang — ambang ini peredam noise,
bukan prediktor sempurna.

**Perubahan (`Config/phase9_rules.json`,
`Script/phase9_risk_engine.js`, `Script/phase11_final_report.js`):**
SPR-02 `min_count` 5 → 30 (jalur alternatif PROVISIONAL ≥3 tidak diubah).
CTR-02 mendapat `min_count` 10: `evaluateCtr02` kini TRIGGERED hanya bila
`qualifying_sequences` ≥ 10 (default 1 bila konfigurasi lama tanpa
`min_count`, agar perilaku lama terjaga di luar paket ini); di bawah
ambang menjadi NOT_TRIGGERED dengan alasan yang memuat disclaimer
"CTR-02 padam ≠ aman". Disclaimer yang sama masuk `limitations`
Phase 11 (dan dengan itu `report.html`) bila CTR-02 NOT_TRIGGERED,
dengan pelajaran LouLou. C3 CTR-03 dan C4 bobot Phase 11 TIDAK diubah
apa pun hasil hitung ulangnya (C3: presisi naik hanya karena recall
runtuh; C4: rerata buruk vs baik nyaris identik di semua varian bobot);
guardrail "dimensi hilang → penalti kepercayaan skor" tetap rancangan
di dossier final, belum diimplementasi.

**Verifikasi:** 5 test baru `tests/ronde25_p5_calibration.test.js`
(kunci konfigurasi 30 & 10; SPR-02 TRIGGERED di 30 / PROVISIONAL di 29;
CTR-02 TRIGGERED di 10 / NOT_TRIGGERED di 9 & 1; disclaimer Phase 11
hadir saat padam, absen saat menyala) + penyesuaian 1 test lama
`phase9_ltr02_ctr.test.js` (fixture CTR-02 lama 1 sequence kini
NOT_TRIGGERED, diubah menjadi 10 funder agar tetap menguji jalur
TRIGGERED). `npm test`: **248/248 PASS** termasuk ekstraksi bersih
dari ZIP. ZIP aktif: `STI_v2026-10-27_ronde25.zip` (ronde24 dihapus).

## Ronde 26 (2026-10-27) — mekanisme rezim dini, skala MENIT (otorisasi Rin 2026-10-27)

Keputusan Rin sore 27 Okt: bangun dulu mekanismenya, angka dini menyusul
dari kohort; skala umur memakai menit, bukan jam, agar presisi (token umur
73 menit vs 240 menit dapat dibedakan).

Perubahan (perilaku matang TIDAK berubah — threshold hari ini tetap):
- `Config/phase9_rules.json`: `settings.early_regime.age_minutes_max = 1440`
  (batas rezim dini, dinyatakan dalam menit); SPR-02 & CTR-02 mendapat slot
  `early_regime.min_count = null` — null berarti warisi threshold matang
  (SPR-02: 30, CTR-02: 10) sampai kohort dini menetapkan angka. Pengisian
  angka dini nanti cukup lewat konfigurasi ini, tanpa ubah kode.
- `Script/phase9_risk_engine.js`: `computeTokenAge()` — umur = waktu mulai
  scan (scan-context `rescanned_at` || `started_at`) minus event Phase 8
  tertua yang teramati (proksi peluncuran; Phase 1 tidak menyimpan stempel
  lahir chain, dan market-volume.json tidak memuat pairCreatedAt — proksi
  ini dilabeli jujur sebagai `birth_source: earliest_phase8_event`).
  Rezim: `early` bila age_minutes ≤ 1440, `mature` bila di atasnya,
  `unknown` bila umur tak dapat ditentukan (selalu pakai threshold matang,
  tidak pernah menebak rezim). Umur + rezim tercatat di
  `phase9-result.json` (`scope.token_age`) dan di metric SPR-02/CTR-02
  (`regime`, `age_minutes`, `age_source`, `threshold_applied`).
- CTR-02: window lag TIDAK dipangkas oleh umur token — funding bisa terjadi
  sebelum token diluncurkan (wallet didanai dulu, baru membeli token baru),
  sehingga pemangkasan itu kesalahan logika. Yang ditambah: slot min_count
  dini + pelaporan lag dalam menit (`lag_minutes.min/median/max`) agar
  kohort bisa menetapkan ambang lag dini.
- `Script/phase11_final_report.js`: bila rezim early, limitations menambah
  baris rezim dini (umur dalam menit + sumber + peringatan bahwa threshold
  matang dipakai sementara dan interpretasi SPR-02/CTR-02 bersifat sementara).

Verifikasi: 11 test baru `tests/ronde26_early_regime.test.js` (batas 1440
inklusif; unknown → matang; override dini vs warisan untuk SPR-02 & CTR-02;
lag menit; limitations Phase 11). `npm test`: **259/259 PASS** termasuk
ekstraksi bersih dari ZIP (unzip → `node merge_config.js` → test).
Uji ujung-ke-ujung Phase 9 atas salinan data scan-3 Baton: rezim `mature`
(umur teramati 68392,1 menit — event tertua 2026-09-09, jadi umur token
Baton dihitung dari peluncuran, bukan dari scan pertama 20 Okt); SPR-02
berubah TRIGGERED → PROVISIONAL (19 sell: di bawah 30 tetapi ≥ ambang
alternatif 3 — KOREKSI atas antisipasi sebelumnya yang menyebut
NOT_TRIGGERED); CTR-02 tetap NOT_TRIGGERED (0 sekuens, ambang 10). Satu-satunya
perubahan status vs scan-3 asli adalah efek kalibrasi SPR-02, sesuai harapan.
ZIP aktif: `STI_v2026-10-27_ronde26.zip` (ronde25 dihapus).

## Ronde 27 (2026-10-27) — audit protokol 24 jam: TIDAK ADA window/threshold yang diubah

Timeline TERKUNCI (keputusan Rin 2026-10-27 malam, dihitung sejak RILIS
CA, bukan sejak scan-1): scan-1 = 1–4 jam setelah rilis; scan-2 = 10–12 jam
setelah rilis; scan-3 (bila perlu) = 24 jam setelah rilis (1440 menit).
Seluruh prosedur dan evaluasi rule harus muat dalam 24 jam itu.

Perintah Rin: perbaiki segera rule yang bertabrakan dengan batas 24 jam.
Hasil audit evaluator-per-evaluator: **tidak ada rule yang bertabrakan**,
sehingga ronde 27 dengan sengaja TIDAK mengubah satu pun window atau
threshold — mengubah tanpa bukti justru melanggar kehati-hatian yang
diminta Rin. Alasannya, per keluarga rule:
- Window adalah BATAS LAG MAKSIMUM antar dua event, bukan syarat lama
  observasi. CTR-05 (window 7 hari) tetap bisa TRIGGERED dari data 24 jam:
  pasangan transfer→sell berlag 3 jam lolos window 7 hari karena lag-nya
  ≤ window. Yang dulu membuat CTR-05 INSUFFICIENT (22/22 Batch 1, 0/20
  Batch 2) adalah verifikasi relationship + kelengkapan histori, bukan
  window-nya. Memangkas window ke 24 jam tidak memperbaiki evaluabilitas,
  hanya membuang deteksi lag panjang untuk token matang — maka window
  CTR-05 TIDAK diubah. (Koreksi atas klaim ronde 26 yang menyebut CTR-05
  "secara struktural tidak bisa dievaluasi dalam 24 jam": klaim itu salah.)
- LTR-02 memakai dua snapshot terbaru; intervalnya DILAPORKAN, bukan
  disyaratkan sama dengan window_seconds. Dua snapshot berjarak 9 jam
  (scan-1 → scan-2) sudah cukup untuk evaluasi; LTR-03 komposit yang sama.
- TCR-04 membagi rentang event yang teramati menjadi dua paruh — tidak
  ada syarat rentang minimum 24 jam. SPR-02/LTR-01 (1 jam), market rule
  (window berbasis jumlah transaksi), dan rule ledger (SPR-01/04) tidak
  punya syarat waktu yang bertabrakan.
- Yang tetap menjadi pekerjaan kohort (bukan perbaikan kode sekarang):
  threshold yang dikalibrasi dari data matang (mis. CTR-02 count 10) mungkin
  terlalu tinggi untuk volume data 24 jam — itulah yang dijawab slot dini
  ronde 26, dengan angka dari kohort dini.

Verifikasi: 5 test baru `tests/ronde27_protocol_24jam.test.js` (kunci
konfigurasi tidak berubah; CTR-05 TRIGGERED dari sekuens 3 jam dalam
observasi 24 jam; CTR-05 tanpa verifikasi tetap tidak menyala; LTR-02
TRIGGERED 30% / NOT_TRIGGERED 10% pada snapshot 9 jam; <2 snapshot tetap
INSUFFICIENT). `npm test`: **264/264 PASS** termasuk ekstraksi bersih
dari ZIP. ZIP aktif: `STI_v2026-10-27_ronde27.zip` (ronde26 dihapus).
