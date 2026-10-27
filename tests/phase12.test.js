const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p12 = require(path.join(root, 'Script/phase12_early_signals.js'));

function phasesFixture(overrides = {}) {
  return {
    2: { authority: { mint: { status: 'REVOKED' }, freeze: { status: 'REVOKED' } } },
    3: { holders: [
      { owner: 'Creator11111111111111111111111111111111', amount_raw: '1000' },
      { owner: 'Early1111111111111111111111111111111111', amount_raw: '500' },
      { owner: 'Other1111111111111111111111111111111111', amount_raw: '8500' }
    ] },
    4: {
      concentration: { adjusted_confirmed_normal: { top_10: { share_of_total_supply_pct: 25 } } },
      liquidity_mapping: {
        status: 'FOUND',
        lock_status_summary: { BURNED: 1 },
        significant_pools: [{ lp_status: { status: 'BURNED' } }]
      }
    },
    5: {
      ownership: { current_percentage_supply: 5 },
      creator_events: { sell: { status: 'NO_SELL_OBSERVED_WITHIN_COVERAGE', sell_count: 0 } },
      creator_discovery: { selected: { address: 'Creator11111111111111111111111111111111' } },
      creator_distribution: { recipients: [] },
      related_wallets: { wallets: [] },
      initial_distribution: {
        first_distribution_time: '2026-10-01T00:00:00.000Z',
        bundler_candidates: []
      }
    },
    8: { wallets: [
      { wallet: 'Early1111111111111111111111111111111111',
        history: { first_observed_acquisition: { block_time: Math.floor(Date.parse('2026-10-01T00:20:00.000Z') / 1000), timestamp_utc: '2026-10-01T00:20:00.000Z' },
          counts_observed: { SELL: 0 } },
        current: { balance_raw: '500' }, sources: [] }
    ] },
    11: { summary: { final_quality_score: 60, classification: { label: 'Sedang' } } },
    ...overrides
  };
}

const cfg = { early_window_minutes: 60, top10_warn_pct: 35, top10_fail_pct: 55, creator_warn_pct: 10, creator_fail_pct: 25 };

test('rug checklist: all PASS on clean fixture', () => {
  const items = p12.rugChecklist(phasesFixture(), cfg);
  assert.equal(items.length, 6);
  for (const i of items) assert.equal(i.status, 'PASS', `${i.id} should PASS`);
});

test('rug checklist: active mint authority is FAIL', () => {
  const ph = phasesFixture();
  ph[2].authority.mint.status = 'ACTIVE';
  const items = p12.rugChecklist(ph, cfg);
  assert.equal(items.find(i => i.id === 'MINT_AUTHORITY').status, 'FAIL');
});

test('rug checklist: unlocked LP is FAIL, unknown stays UNKNOWN', () => {
  const ph = phasesFixture();
  ph[4].liquidity_mapping.significant_pools = [{ lp_status: { status: 'UNLOCKED' } }];
  assert.equal(p12.rugChecklist(ph, cfg).find(i => i.id === 'LP_LOCK').status, 'FAIL');
  const ph2 = phasesFixture();
  ph2[4].liquidity_mapping.significant_pools = [];
  ph2[4].liquidity_mapping.status = 'NOT_FOUND';
  assert.equal(p12.rugChecklist(ph2, cfg).find(i => i.id === 'LP_LOCK').status, 'UNKNOWN');
});

test('verdict: AVOID on any FAIL, CAUTION on 2 WARN, WATCH on 1 WARN', () => {
  const mk = (statuses) => statuses.map((s, i) => ({ id: `I${i}`, label: `item ${i}`, status: s, detail: null }));
  assert.equal(p12.verdict(mk(['PASS','PASS','FAIL','PASS','PASS','PASS']), cfg).verdict, 'AVOID');
  assert.equal(p12.verdict(mk(['PASS','WARN','WARN','PASS','PASS','UNKNOWN']), cfg).verdict, 'CAUTION');
  assert.equal(p12.verdict(mk(['PASS','WARN','PASS','PASS','PASS','PASS']), cfg).verdict, 'WATCH');
  assert.equal(p12.verdict(mk(['PASS','PASS','PASS','PASS','PASS','UNKNOWN']), cfg).verdict, 'NEUTRAL_OK');
});

test('early birds: detected within window, holding state correct', () => {
  const birds = p12.earlyBirds(phasesFixture(), cfg);
  assert.equal(birds.early_bird_count, 1);
  assert.equal(birds.early_birds_still_holding, 1);
  assert.ok(birds.early_birds[0].first_acquisition_minutes_after_launch <= 60);
});

test('early birds: outside window excluded', () => {
  const ph = phasesFixture();
  ph[8].wallets[0].history.first_observed_acquisition.block_time =
    Math.floor(Date.parse('2026-10-01T05:00:00.000Z') / 1000);
  const birds = p12.earlyBirds(ph, cfg);
  assert.equal(birds.early_bird_count, 0);
});

test('buildResult: shape, version, offline mode, disclaimer', () => {
  const r = p12.buildResult({ mint: '8DXqVUopcdviLvujTcpwEqkKzB43Arp6E1axzsEE5Btq', dir: '/tmp', phases: phasesFixture(), cfg });
  assert.equal(r.phase, 12);
  assert.equal(r.version, p12.VERSION);
  assert.equal(r.input.mode, 'OFFLINE_ARTIFACT_ONLY');
  assert.equal(r.verdict.verdict, 'NEUTRAL_OK');
  assert.match(r.verdict.disclaimer, /BUKAN/);
  assert.equal(r.social.status, 'NOT_PROVIDED');
});
