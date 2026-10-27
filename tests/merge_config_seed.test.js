const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

// Build a minimal fresh-clone-shaped temp project: merge_config.js +
// Config/config.json.example + Data dir, but NO Config/config.json.
function freshProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sti-merge-test-'));
  fs.mkdirSync(path.join(dir, 'Config'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'Data'), { recursive: true });
  fs.copyFileSync(path.join(root, 'merge_config.js'), path.join(dir, 'merge_config.js'));
  fs.copyFileSync(path.join(root, 'Config', 'config.json.example'), path.join(dir, 'Config', 'config.json.example'));
  fs.writeFileSync(path.join(dir, 'Data', 'database-wallet.json'), '[]\n', 'utf8');
  return dir;
}

function runMerge(dir) {
  const out = execFileSync(process.execPath, ['merge_config.js'], { cwd: dir, encoding: 'utf8' });
  return out;
}

test('merge_config.js tidak crash saat Config/config.json belum ada (fresh clone)', () => {
  const dir = freshProject();
  const out = runMerge(dir);
  const cfgPath = path.join(dir, 'Config', 'config.json');
  assert.ok(fs.existsSync(cfgPath), 'Config/config.json harus dibuat');
  const c = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  // seed dari example
  assert.equal(c.helius.api_key, 'PASTE_YOUR_HELIUS_API_KEY_HERE');
  // semua section yang di-deep-ensure tetap ditambahkan
  for (const section of ['rpc_throttle', 'market_volume', 'scoring', 'database_conviction', 'relationships', 'evaluation_guards']) {
    assert.ok(c[section] !== undefined, `section ${section} harus ada`);
  }
  assert.equal(c.market_volume.concurrency, 3);
  assert.equal(c.scoring.modifiers.blocked, -10);
  assert.match(out, /helius\.api_key tidak disentuh/);
});

test('merge_config.js tidak menyentuh nilai yang sudah ada (api_key + custom throttle)', () => {
  const dir = freshProject();
  const cfgPath = path.join(dir, 'Config', 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify({
    helius: { api_key: 'REALKEY_ABC123' },
    rpc_throttle: { min_interval_ms: 60 },
  }, null, 2), 'utf8');
  runMerge(dir);
  const c = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  assert.equal(c.helius.api_key, 'REALKEY_ABC123', 'api_key tidak boleh dioverwrite');
  assert.equal(c.rpc_throttle.min_interval_ms, 60, 'nilai custom tidak boleh dioverwrite');
  // key baru di section yang sudah ada tetap diisi
  assert.equal(c.market_volume.concurrency, 3);
});

test('merge_config.js idempoten: run kedua tidak mengubah nilai', () => {
  const dir = freshProject();
  runMerge(dir);
  const cfgPath = path.join(dir, 'Config', 'config.json');
  const first = fs.readFileSync(cfgPath, 'utf8');
  const out = runMerge(dir);
  const second = fs.readFileSync(cfgPath, 'utf8');
  assert.equal(second, first, 'run kedua tidak boleh mengubah file');
  assert.match(out, /tidak ada yang diubah/);
});
