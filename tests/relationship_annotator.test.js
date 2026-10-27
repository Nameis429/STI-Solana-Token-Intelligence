'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ann = require(path.join(root, 'Script/relationship_annotator.js'));
const p9 = require(path.join(root, 'Script/phase9_risk_engine.js'));
const rules = require(path.join(root, 'Config/phase9_rules.json'));

const T0 = 1700000000;
const rule = { window_seconds: 604800, min_count: 2 };
const CFG = { relationships: { enabled: true } };
// S dan R berbagi funder F; X tidak terkait siapa pun.
const FG = { wallets: {
  S: { funders: [{ funder: 'F' }] },
  R: { funders: [{ funder: 'F' }] },
  X: { funders: [{ funder: 'Z' }] },
} };

function row(wallet, event) { return { wallet, event }; }
function transfer(sender, recipient, ts) {
  // Direpresentasikan dari sisi penerima (RECEIVE) seperti output phase8.
  return row(recipient, { event_class: 'RECEIVE', block_time: ts, counterparty: sender, signature: `t-${sender}-${recipient}-${ts}` });
}
function sell(wallet, ts) {
  return row(wallet, { event_class: 'SELL', block_time: ts, signature: `s-${wallet}-${ts}` });
}

test('shared funder: transfer + SELL berpasangan dianotasi id yang sama', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const out = ann.annotateRelationships(ev, FG, rule, CFG);
  assert.equal(out[0].event.relationship_id, 'funder:F');
  assert.equal(out[0].event.relationship_verified, true);
  assert.equal(out[1].event.relationship_id, 'funder:F');
  assert.equal(out[1].event.relationship_verified, true);
});

test('tanpa shared funder: tidak ada anotasi', () => {
  const ev = [transfer('S', 'X', T0), sell('X', T0 + 100)];
  const out = ann.annotateRelationships(ev, FG, rule, CFG);
  assert.equal(out[0].event.relationship_id, undefined);
  assert.equal(out[1].event.relationship_id, undefined);
});

test('SELL di luar window rule: tidak dianotasi', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 604801)];
  const out = ann.annotateRelationships(ev, FG, rule, CFG);
  assert.equal(out[0].event.relationship_id, undefined);
  assert.equal(out[1].event.relationship_id, undefined);
});

test('beberapa shared funder: id deterministik (leksikografis terkecil)', () => {
  const fg2 = { wallets: {
    S: { funders: [{ funder: 'F2' }, { funder: 'F1' }] },
    R: { funders: [{ funder: 'F1' }, { funder: 'F2' }] },
  } };
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const out = ann.annotateRelationships(ev, fg2, rule, CFG);
  assert.equal(out[0].event.relationship_id, 'funder:F1');
  assert.equal(out[1].event.relationship_id, 'funder:F1');
});

test('satu SELL hanya dipasangkan sekali (greedy cerminan matcher)', () => {
  const ev = [transfer('S', 'R', T0), transfer('S', 'R', T0 + 50), sell('R', T0 + 100)];
  const out = ann.annotateRelationships(ev, FG, rule, CFG);
  const annotated = out.filter(r => r.event.relationship_id);
  assert.equal(annotated.length, 2); // 1 transfer + 1 sell
  assert.equal(out[0].event.relationship_id, 'funder:F');
  assert.equal(out[1].event.relationship_id, undefined); // transfer kedua: sell sudah dipakai
});

test('tidak menimpa relationship_id yang sudah ada', () => {
  const ev = [row('R', { event_class: 'RECEIVE', block_time: T0, counterparty: 'S', signature: 't1', relationship_id: 'manual:1', relationship_verified: true }),
    sell('R', T0 + 100)];
  const out = ann.annotateRelationships(ev, FG, rule, CFG);
  assert.equal(out[0].event.relationship_id, 'manual:1');
  assert.equal(out[1].event.relationship_id, undefined);
});

test('disabled via config: tidak ada anotasi', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const out = ann.annotateRelationships(ev, FG, rule, { relationships: { enabled: false } });
  assert.equal(out[0].event.relationship_id, undefined);
});

test('tanpa funding graph: input dikembalikan apa adanya', () => {
  const ev = [transfer('S', 'R', T0)];
  assert.equal(ann.annotateRelationships(ev, null, rule, CFG), ev);
});

test('input tidak dimutasi', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const before = JSON.stringify(ev);
  ann.annotateRelationships(ev, FG, rule, CFG);
  assert.equal(JSON.stringify(ev), before);
});

test('transferSellSequences mengenali pasangan teranotasi (requireRelationship)', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const annotated = ann.annotateRelationships(ev, FG, rule, CFG);
  const ms = p9.transferSellSequences(annotated, 604800, { requireRelationship: true });
  assert.equal(ms.length, 1);
  assert.equal(ms[0].relationship_verified, true);
  assert.equal(ms[0].relationship_id, 'funder:F');
});

test('tanpa anotasi, requireRelationship menghasilkan 0 match', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const ms = p9.transferSellSequences(ev, 604800, { requireRelationship: true });
  assert.equal(ms.length, 0);
});

// --- end-to-end via runEvaluation + funding-graph.json sidecar ---
function withTempMintDir(mint, files, fn) {
  const dir = path.join(root, 'Output', mint);
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  try {
    for (const [name, data] of Object.entries(files)) {
      const fp = path.join(dir, name);
      fs.writeFileSync(fp, JSON.stringify(data));
      written.push(fp);
    }
    return fn();
  } finally {
    for (const fp of written) fs.rmSync(fp, { force: true });
    try { fs.rmdirSync(dir); } catch {}
  }
}
function p8wallet(wallet, events) { return { wallet, history: { events } }; }

test('CTR-05 TRIGGERED end-to-end: 2 sekuens terverifikasi via funding graph', () => {
  const mint = 'CTR05AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1';
  const fg = { wallets: {
    S1: { funders: [{ funder: 'F' }] }, R1: { funders: [{ funder: 'F' }] },
    S2: { funders: [{ funder: 'G' }] }, R2: { funders: [{ funder: 'G' }] },
  } };
  const phase8 = { wallets: [
    p8wallet('R1', [
      { event_class: 'RECEIVE', block_time: T0, counterparty: 'S1', signature: 't1' },
      { event_class: 'SELL', block_time: T0 + 100, signature: 's1', amount_raw: '10' },
    ]),
    p8wallet('R2', [
      { event_class: 'RECEIVE', block_time: T0 + 200, counterparty: 'S2', signature: 't2' },
      { event_class: 'SELL', block_time: T0 + 300, signature: 's2', amount_raw: '10' },
    ]),
  ] };
  withTempMintDir(mint, { 'funding-graph.json': fg }, () => {
    const r = p9.runEvaluation({ rules, phase8, phase4: null, phase5: null, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'CTR-05');
    assert.equal(s.status, 'TRIGGERED');
    assert.equal(s.metric.linked_event_count, 2);
  });
});

test('CTR-05 tetap INSUFFICIENT_DATA tanpa funding graph (tidak dipaksa)', () => {
  const mint = 'CTR05BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2';
  const phase8 = { wallets: [p8wallet('R1', [
    { event_class: 'RECEIVE', block_time: T0, counterparty: 'S1', signature: 't1' },
    { event_class: 'SELL', block_time: T0 + 100, signature: 's1', amount_raw: '10' },
  ])] };
  withTempMintDir(mint, {}, () => {
    const r = p9.runEvaluation({ rules, phase8, phase4: null, phase5: null, mint, source: 'test' });
    const s = r.rules.find(x => x.rule_id === 'CTR-05');
    // 1 sekuens < min_count 2 dan coverage tidak komplet -> INSUFFICIENT_DATA
    assert.equal(s.status, 'INSUFFICIENT_DATA');
  });
});

test('CTR-03 tidak berubah oleh anotasi (requireRelationship=false)', () => {
  const ev = [transfer('S', 'R', T0), sell('R', T0 + 100)];
  const annotated = ann.annotateRelationships(ev, FG, rule, CFG);
  const plain = p9.transferSellSequences(ev, 604800, {});
  const annM = p9.transferSellSequences(annotated, 604800, {});
  assert.equal(plain.length, annM.length);
});
