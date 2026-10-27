const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const p6 = require(path.join(root, 'Script/phase6_fee_trading_economics.js'));

function blank() {
  return { protocol_state: { status: 'UNKNOWN', programs: [], global_configs: [], fee_config_accounts: [] } };
}

test('finalizeProtocolState: no supported pools -> NOT_APPLICABLE (not UNKNOWN)', () => {
  const r = blank();
  assert.equal(p6.finalizeProtocolState(r), 'NOT_APPLICABLE');
  assert.equal(r.protocol_state.status, 'NOT_APPLICABLE');
});

test('finalizeProtocolState: parsed global -> FOUND', () => {
  const r = blank();
  r.protocol_state.global_configs = [{ program: 'PumpSwap', address: 'X', status: 'FOUND', state: { status: 'PARSED' } }];
  assert.equal(p6.finalizeProtocolState(r), 'FOUND');
});

test('finalizeProtocolState: parsed + failure -> PARTIAL', () => {
  const r = blank();
  r.protocol_state.global_configs = [
    { program: 'PumpSwap', address: 'X', status: 'FOUND', state: { status: 'PARSED' } },
    { program: 'PumpSwap', address: 'Y', status: 'PARSE_FAILED' }
  ];
  assert.equal(p6.finalizeProtocolState(r), 'PARTIAL');
});

test('finalizeProtocolState: failure only -> FAILED', () => {
  const r = blank();
  r.protocol_state.global_configs = [{ program: 'PumpSwap', address: 'Y', status: 'PARSE_FAILED' }];
  assert.equal(p6.finalizeProtocolState(r), 'FAILED');
});

test('finalizeProtocolState: upstream failure -> NOT_DETERMINED (early-exit path)', () => {
  const r = blank();
  assert.equal(p6.finalizeProtocolState(r, true), 'NOT_DETERMINED');
  assert.match(r.protocol_state.note, /did not run/);
});

test('finalizeProtocolState: never leaves UNKNOWN on any path', () => {
  for (const args of [[blank()], [blank(), true]]) {
    const r = args[0];
    p6.finalizeProtocolState(...args);
    assert.notEqual(r.protocol_state.status, 'UNKNOWN');
  }
});
