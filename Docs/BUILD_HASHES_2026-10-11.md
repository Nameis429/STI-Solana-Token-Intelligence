# Build Hashes — STI
**Tanggal:** 2026-10-11 (rev 4.7 — helper X manual)
**Cakupan:** main.js + package.json + seluruh Script/*.js + Config/*.json (tanpa Config/config.json yang mungkin berisi secret) + tests/*.test.js

Perubahan sejak rev 4.6 (atas pertanyaan Rin soal gabungan X + Reddit):
- X tanpa login tidak mungkin (bearer publik 401, Nitter mati, login-wall) — diverifikasi langsung 2026-10-11.
- BARU `Script/set_social_x.js`: catat sinyal X manual ke Data/social_signals.json tanpa menimpa data Reddit; sentimen manusia mengalahkan `unknown` otomatis; heat gabungan ditampilkan.
- Phase 9/11/12 dan seluruh rule TIDAK berubah (tetap terkunci).

| File | SHA-256 |
|------|---------|
| `main.js` | `f7ed6b89cfa82b5db9606c400427d02b30244b627d8224ebc0f3192172ae006a` |
| `package.json` | `2c7e32fdcd7c34c5745e58bb554c23a027a5779e09ff5c3d4753ffd458694612` |
| `Script/behavior_adjustment_engine.js` | `89ddbce2432ebe1c3e3bae3a35c90c7a19151c9e8f6eab6b34d2ec66df83d56b` |
| `Script/collect_funding_graph.js` | `af5f06e6a5f15bd3d6169c040764e4271e762b0122c1a1cf860684c5aa1cb224` |
| `Script/collect_market_volume.js` | `0afa112a519b4a6a21fb4bfbf9d0e83aff7429e43b581fdf13dc59c60acf0dee` |
| `Script/collect_social_reddit.js` | `e1c0f360168ce216674eb6e0dbf0a19f132835bbf757cfdfbe7e48d6145b7a62` |
| `Script/coverage_contract.js` | `7362e13c765025c80df174a41fdcb317902ecd4a005d09182d307b8758cbb2d1` |
| `Script/generate_html_report.js` | `e3ff1944ee23493f08dfc49e5707bdbbf6917415646048d37346f2f38d9034f8` |
| `Script/phase10_scoring_engine.js` | `4bd5dd3148d1d0ac28f97d458b3127e65f54b9483f5b5961f4f4ef8fa488508a` |
| `Script/phase10_wallet_intelligence_simulation.js` | `a6bdb13b60c056d0a48255a975af7d2f90587e690320a5ed7999412d9de0ebdc` |
| `Script/phase11_final_report.js` | `ef3f4f61ab7d1f7793a54912c6ae99aec24c7fe80e932701d4247002479f66a1` |
| `Script/phase12_early_signals.js` | `234b646049d328a5d59191b31811d43e9e072694bbd43390ccf0c45c3b813be2` |
| `Script/phase1_token_discovery.js` | `33e8fb02de2bfa2c43e1f6fb30a2309b9d58b9c99f8e98f39f46783ce4381260` |
| `Script/phase2_token_authority_supply.js` | `b6244a0473a9544930a273bf31dc802dd1c7954021a4f1b7c6a1e5c75b1fff15` |
| `Script/phase3_holder_discovery.js` | `73cc5d9d563c12acb889651b6ff3ec7014c40b9f49eed923f5b42603b39c9ce6` |
| `Script/phase4_holder_concentration.js` | `55d4842b2af746a4687e6c800d719028428d6b96510f7523701fd568c37553e0` |
| `Script/phase5_coverage.js` | `a5d0bc295951b198e5c3be3f20c23e9f7d836e5897f5bee49f60d402234d9d02` |
| `Script/phase5_creator_dev_analysis.js` | `8388f32c16cdeebc9ff7c44acf3cdbbc45e32a7dcad5c9f0ed5f55a5170cc7e1` |
| `Script/phase6_fee_trading_economics.js` | `85a7ae84ac5bead94770f07a787c1015fb662816b1b1590b58822d2b5fdb2ef2` |
| `Script/phase7_database_wallet_matching.js` | `fc6be6c6d638d7ca941226cce68a3245623e303555a91dead49288fd840bd89d` |
| `Script/phase8_wallet_behavior_timeline.js` | `0c98a478c334a3fff58a4deffd760af12f32b02f31ad3ba90bd273ed9c4bbc38` |
| `Script/phase9_risk_engine.js` | `a799ec613046788a4b34797c2100656beade4892bab28413786b6f63479b9fad` |
| `Script/run_metadata.js` | `e103e5998ad3ad894fa7f5ea8fdbc5de07f581edb4ae0e131b4174cf6520093f` |
| `Script/set_key.js` | `b99486f9b8743b1290203892b39bd524c288764c62a83a660bac3a8638603602` |
| `Script/set_social_x.js` | `b7aacce6a056976167fb75717bc8a5e53775c07db2ea51d755335dda2afab2d2` |
| `Script/wallet_role_normalizer.js` | `2496c43a7e92af846c605c7ea0d69cb9d630a1441487bc770b8787ebaebcf87e` |
| `Config/phase9_rules.json` | `aed0f61f8a87b84d235a4d8e52b3450352cb050dee8d9a78fcfe190fcbd3a4a9` |
| `tests/collect_social_reddit.test.js` | `43111ccb442557598069c53f601044fb2c352d030c1201706716f789adef6f45` |
| `tests/p0-runtime.test.js` | `58b2acbd1c84ce421edbb3b494038020950b09d3c79005bcf9ec60c62d10ad21` |
| `tests/phase12.test.js` | `3aca0464ba1493d9be7e5f16490ba439762b0456fda6ce2b4a2fbd24fc1d350a` |
| `tests/phase6_protocol_state.test.js` | `f60f574ac7c1e56f6f80f7c254ec402c768b8ffd4a59c00e18b9540bdd7071bb` |
| `tests/phase9_ltr02_ctr.test.js` | `056b70824e76f32876c044a03913e09f924a7a98637df55fd527ddcb3b20c9ad` |
| `tests/phase9_round4.test.js` | `4946e73e4168a8875b6eb5d99173c238401e1ee6aa7381c3cf32e114c6205d5d` |
| `tests/phase9_round5.test.js` | `e007db10c9b9166eb34c9316f173a41719403813c8b25caa626d5c40969b7ddc` |
| `tests/phase9_round6.test.js` | `984788057f2c09d2f1d42b14c365c90ad5fd4038dd9a079e798c238c9a1dbce8` |
| `tests/phase9_spr01.test.js` | `9d966d91c205f6622d0b3fc5066191a5e4d9931c6eb79db52374e2ac4a13e15b` |
| `tests/phase9_spr04_05_ltr01.test.js` | `9efcf8c422a24eb62e985e1a8de0e8e44dbf6823bb6b5903b349b3ed86a330b7` |

**Test:** 110/110 PASS (`npm test`), termasuk 2 test `mergeXDoc`.
