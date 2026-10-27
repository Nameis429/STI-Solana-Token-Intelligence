'use strict';
/* Ronde 21 (P3): coverage Phase 8 di bawah kuota.
 * 1) Antrean prioritas bertier: DB-matched (tier 1) > top holder
 *    (tier 2) > terkait-creator (tier 3) > lainnya (tier 4). Di dalam
 *    tier 1 role spesial DB mendahului; tier 2 menurut peringkat holder.
 * 2) Preset retry: config phase8.retry_preset tersedia ('standard'
 *    bawaan = perilaku lama; 'patient' = multi-pass jeda panjang).
 * 3) Peringatan sidecar sebelum Phase 9 tinggal di main.js (runPhase)
 *    — diuji bentuk sumbernya karena main.js interaktif. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { collectCandidates, computeSelectionTier } = require(path.join(root, 'Script/phase8_wallet_behavior_timeline.js'));

const W = ch => ch.repeat(32);
function fixtureInput() {
  return {
    phase7: { matches: [
      { wallet: W('B'), database: { roles: [] }, appearances: [], current: { is_holder: false }, history: {}, position: {} },
      { wallet: W('A'), database: { roles: ['WHALE'] }, appearances: [], current: { is_holder: true }, history: {}, position: {} },
      { wallet: W('C'), database: { roles: [] }, appearances: [], current: { is_holder: true }, history: {}, position: {} },
    ]},
    phase3: { holders: [
      { owner: W('C'), rank: 2, amount_raw: '5' },
      { owner: W('D'), rank: 1, amount_raw: '9' },
    ]},
    phase5: { creator_discovery: { selected: { address: W('E') }, candidates: [] }, creator_distribution: { recipients: [] }, related_wallets: { wallets: [] }, initial_distribution: { clusters: [] } },
    phase6: { fee_components: [], fee_destinations: { components: [] }, downstream_usage: { flows: [{ address: W('F') }] } },
  };
}

test('tier: urutan antrean DB-spesial > DB-holder > DB-umum > top-holder(peringkat) > creator > lain', () => {
  const out = collectCandidates(fixtureInput(), { top_holder_count: 25 });
  const order = out.map(c => c.wallet[0]);
  assert.deepEqual(order, ['A', 'C', 'B', 'D', 'E', 'F']);
  assert.deepEqual(out.map(c => c.selection_tier), [1, 1, 1, 2, 3, 4]);
});

test('tier: wallet multi-sumber mengambil tier terbaiknya', () => {
  assert.equal(computeSelectionTier(['PHASE3_TOP_HOLDER', 'PHASE7_DATABASE_MATCH']), 1);
  assert.equal(computeSelectionTier(['PHASE5_CREATOR', 'PHASE3_TOP_HOLDER']), 2);
  assert.equal(computeSelectionTier(['PHASE6_FEE_RECIPIENT']), 3);
  assert.equal(computeSelectionTier(['PHASE6_DOWNSTREAM_RECIPIENT']), 4);
  assert.equal(computeSelectionTier([]), 4);
  // C pada fixture: DB-match + top holder -> tetap tier 1
  const out = collectCandidates(fixtureInput(), {});
  assert.equal(out.find(c => c.wallet === W('C')).selection_tier, 1);
});

test('retry preset: config contoh memuat retry_preset standard; kode memuat resolusi patient 3-pass', () => {
  const example = JSON.parse(fs.readFileSync(path.join(root, 'Config/config.json.example'), 'utf8'));
  assert.equal(example.phase8.retry_preset, 'standard');
  const src = fs.readFileSync(path.join(root, 'Script/phase8_wallet_behavior_timeline.js'), 'utf8');
  assert.match(src, /retry_preset/);
  assert.match(src, /preset==='patient'\?3:1/);
  assert.match(src, /retry_passes_executed/);
  assert.match(src, /retry_still_rate_limited=pending\.length/);
});

test('peringatan sidecar: main.js memeriksa funding-graph & market-volume sebelum Phase 9', () => {
  const src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(src, /function warnMissingSidecars/);
  assert.match(src, /funding-graph\.json/);
  assert.match(src, /market-volume\.json/);
  assert.match(src, /if \(p\.n === 9\) warnMissingSidecars\(mint\)/);
});
