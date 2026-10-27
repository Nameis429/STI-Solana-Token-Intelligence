'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { normalizeWalletRoles, calculateRoleWeight, extractModifiers } =
  require(path.join(root, 'Script/wallet_role_normalizer.js'));

// Nilai Rin: 🚫 = -10, 🚩 = -5 (config-driven).
const SCORING = { wallet_weights: { default: 1, early: 2, whale: 3, dev: -1, rug_kol: -2 },
  modifiers: { star: 5, priority: 2, flag: -5, blocked: -10 } };

test('🚫 di name terdeteksi dengan bobot -10 (config Rin)', () => {
  const m = extractModifiers({ name: 'D-106🚫', emoji: '' }, SCORING);
  assert.deepEqual(m.symbols, ['🚫']);
  assert.equal(m.weight, -10);
});

test('🚩 di name terdeteksi dengan bobot -5 (config Rin)', () => {
  const m = extractModifiers({ name: 'Rug-167🚩', emoji: '' }, SCORING);
  assert.deepEqual(m.symbols, ['🚩']);
  assert.equal(m.weight, -5);
});

test('emoji negatif di field emoji juga terdeteksi', () => {
  const m = extractModifiers({ name: 'D-106', emoji: '🚫' }, SCORING);
  assert.deepEqual(m.symbols, ['🚫']);
  assert.equal(m.weight, -10);
});

test('tidak double-count bila emoji ada di name dan field emoji', () => {
  const m = extractModifiers({ name: 'D-106🚫', emoji: '🚫' }, SCORING);
  assert.deepEqual(m.symbols, ['🚫']);
  assert.equal(m.weight, -10);
});

test('default tanpa config: 🚩 -5, 🚫 -10', () => {
  assert.equal(extractModifiers({ name: 'A🚩' }, {}).weight, -5);
  assert.equal(extractModifiers({ name: 'B🚫' }, {}).weight, -10);
  assert.equal(extractModifiers({ name: 'C🚩' }).weight, -5);
});

test('nilai bisa di-override dari config tanpa ubah kode', () => {
  const m = extractModifiers({ name: 'X🚩' }, { modifiers: { flag: -3 } });
  assert.equal(m.weight, -3);
});

test('⭐ dan 💚 positif tidak berubah', () => {
  assert.equal(extractModifiers({ name: 'E⭐', emoji: '' }, SCORING).weight, 5);
  assert.equal(extractModifiers({ name: 'F💚', emoji: '' }, SCORING).weight, 2);
});

test('kombinasi positif + negatif dijumlahkan', () => {
  const m = extractModifiers({ name: 'G⭐🚫', emoji: '' }, SCORING);
  assert.deepEqual(m.symbols, ['⭐', '🚫']);
  assert.equal(m.weight, -5);
});

test('stacking role + modifier terdokumentasi: DEV(-1) + 🚫(-10) = -11', () => {
  const w = { name: 'D-106🚫', groups: ['Dev'] };
  const roles = normalizeWalletRoles(w).roles;
  const total = calculateRoleWeight(roles, SCORING) + extractModifiers(w, SCORING).weight;
  assert.deepEqual(roles, ['DEV']);
  assert.equal(total, -11);
});

test('stacking role + modifier: RUG/KOL(-2) + 🚩(-5) = -7', () => {
  const w = { name: 'Rug-167🚩', groups: ['Rug/Kol'] };
  const roles = normalizeWalletRoles(w).roles;
  const total = calculateRoleWeight(roles, SCORING) + extractModifiers(w, SCORING).weight;
  assert.deepEqual(roles, ['RUG/KOL']);
  assert.equal(total, -7);
});

test('wallet tanpa emoji negatif: perilaku lama tidak berubah', () => {
  const w = { name: 'D-1', emoji: '', groups: ['Dev'] };
  const m = extractModifiers(w, SCORING);
  assert.deepEqual(m.symbols, []);
  assert.equal(m.weight, 0);
  assert.equal(calculateRoleWeight(normalizeWalletRoles(w).roles, SCORING), -1);
});
