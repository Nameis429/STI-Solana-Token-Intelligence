const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'Config/config.json'), 'utf8'));
const sourceFiles = fs.readdirSync(path.join(root, 'Script'))
  .filter(name => name.endsWith('.js'))
  .map(name => ({ name, text: fs.readFileSync(path.join(root, 'Script', name), 'utf8') }));

test('config provides a clear placeholder for the Helius API key', () => {
  assert.equal(config.helius.api_key, 'PASTE_YOUR_HELIUS_API_KEY_HERE');
});

test('all Helius-consuming phases read credentials from Config/config.json', () => {
  const expectedNames = ['phase1_token_discovery.js', 'phase2_token_authority_supply.js', 'phase3_holder_discovery.js', 'phase4_holder_concentration.js', 'phase5_creator_dev_analysis.js', 'phase6_fee_trading_economics.js', 'phase7_database_wallet_matching.js', 'phase8_wallet_behavior_timeline.js'];
  const consumers = sourceFiles.filter(({ name }) => expectedNames.includes(name));
  assert.equal(consumers.length, expectedNames.length, `expected ${expectedNames.length} Helius phase consumers, found ${consumers.length}`);
  for (const { name, text } of consumers) {
    assert.match(text, /c\.helius\.api_key\s*=\s*String\(c\.helius\??\.api_key/, `${name} should read the key from config`);
    assert.doesNotMatch(text, /process\.env\.HELIUS_API_KEY/, `${name} should not require an environment variable`);
    assert.match(text, /HELIUS_API_KEY_NOT_CONFIGURED/, `${name} should validate missing credentials`);
  }
});

test('Phase 11 source includes 6M data-quality assessment without numeric score', () => {
  const p11 = fs.readFileSync(path.join(root, 'Script/phase11_final_report.js'), 'utf8');
  assert.match(p11, /DATA_QUALITY_ASSESSMENT_V1/);
  assert.match(p11, /numeric_score:\s*null/);
  assert.match(p11, /SCORING_SUPPORT_CONFIDENCE_V1/);
});

test('HTML generator distinguishes data quality from scoring confidence', () => {
  const html = fs.readFileSync(path.join(root, 'Script/generate_html_report.js'), 'utf8');
  assert.match(html, /Data Quality Assessment/);
  assert.match(html, /Scoring support confidence/i);
});

test('8DXq Phase 11 output preserves locked score and 6M assessment', () => {
  const out = path.join(root, 'Output/8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq');
  const p11 = JSON.parse(fs.readFileSync(path.join(out, 'phase11-result.json'), 'utf8'));
  // Baseline 2026-10-11: 57 -> 60. BUKAN perubahan formula (weighted mean +
  // bobot 20/20/15/10/25 tetap terkunci): perbaikan bug pemetaan status
  // creator_activity — 'NO_SELL_OBSERVED_WITHIN_COVERAGE' yang valid kini
  // dipetakan ke 65, bukan jatuh ke netral 50. weighted_sum 4575 -> 4800.
  // Confidence 52.88 -> 54.14: nilai lama stale, artefak deterministik kini 54.14.
  // Rev 2026-10-11: 54.14 -> 55.53 setelah SPR-01 dapat evaluator eksplisit
  // (3/18 rule punya evaluator vs 2/18). Kenaikan confidence adalah efek yang
  // diinginkan dari cakupan evaluator, bukan perubahan formula.
  assert.equal(p11.version, '1.2.0-6M');
  // Rev 2026-10-11 (2): 60 -> 58 setelah SPR-04 dapat evaluator eksplisit.
  // BUKAN perubahan formula: rule baru menambah temuan lewat pipeline terkunci
  // (agregasi novelty Tahap 2). weighted_sum 4800 -> 4612.5, raw 57.65625.
  // Rev 2026-10-11 (3): 58 -> 53 setelah full scan rev5 (4 rule baru TRIGGERED:
  // SPR-05, LTR-01, LTR-04, TCR-01 menambah temuan risiko; weighted_sum
  // 4612.5 -> 4230.25). BUKAN perubahan formula.
  // Rev 2026-10-12: baseline SEHAT setelah Opsi B + phase 8 pulih dari rate limit
  // (16/18 rule terevaluasi; confidence 71.54 -> 74.82). holder 60 -> 61.8
  // (+1.8 adjustment DB: retention 0.56, conviction +0.12); risk 2.21 -> 0
  // (base 1.9 - 6.16 adjustment DB: coordinated_sell 0.22, fast_exit 0.44;
  // floor 0). Skor akhir tetap 53 — kebetulan pembulatan, komposisinya berubah:
  // weighted_sum 4230.25 -> 4211, raw 52.878125 -> 52.6375.
  assert.equal(p11.summary.final_quality_score, 53);
  assert.equal(p11.score_explainability.weighted_sum, 4211);
  assert.equal(p11.score_explainability.available_weight, 80);
  assert.equal(p11.score_explainability.raw_score, 52.6375);
  assert.equal(p11.score_explainability.final_score, 53);
  assert.equal(p11.summary.confidence.score, 74.82);
  assert.equal(p11.summary.data_quality.numeric_score, null);
  assert.equal(p11.summary.data_quality.not_used_for_scoring, true);
});

test('8DXq HTML matches Phase 11 semantics and contains no object coercion leak', () => {
  const out = path.join(root, 'Output/8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq');
  const html = fs.readFileSync(path.join(out, 'report.html'), 'utf8');
  assert.match(html, /Data Quality Assessment/);
  assert.match(html, /Scoring support confidence/i);
  assert.match(html, /<b>53<\/b>/);
  assert.doesNotMatch(html, /\[object Object\]/);
});
