#!/usr/bin/env node
'use strict';

/**
 * STI — HTML Report Generator
 * Stage 6L
 *
 * Source of truth: Output/<mint>/phase1-result.json ... phase11-result.json
 * Presentation only: this script MUST NOT recalculate or modify scoring.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildComparison } = require('./scan_compare');

const ROOT = path.join(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'Output');

const readJson = file => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
};
const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const num = (value, digits = 2) => {
  // null/undefined/'' mean "no data" — never coerce to 0 (that produced
  // misleading "0%" supply figures for wallets without a computed share).
  if (value === null || value === undefined || value === '') return 'N/A';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
};
const short = (value, chars = 5) => {
  const s = String(value ?? '');
  return s.length > chars ? `${s.slice(0, chars)}…` : s;
};
const safeArray = value => Array.isArray(value) ? value : [];
const safeObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function formatWIB(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(d).replace(',', '') + ' WIB';
}

function locateMint(mint) {
  if (mint) {
    const dir = path.join(OUTPUT_ROOT, mint);
    if (!fs.existsSync(dir)) throw new Error(`Output mint tidak ditemukan: ${mint}`);
    return { mint, dir };
  }
  const dirs = fs.existsSync(OUTPUT_ROOT)
    ? fs.readdirSync(OUTPUT_ROOT, { withFileTypes: true }).filter(x => x.isDirectory())
    : [];
  const found = dirs.map(d => ({ mint: d.name, dir: path.join(OUTPUT_ROOT, d.name) }))
    .filter(x => fs.existsSync(path.join(x.dir, 'phase11-result.json')));
  if (found.length === 1) return found[0];
  if (!found.length) throw new Error('Tidak menemukan phase11-result.json. Jalankan Phase 1–11 terlebih dahulu.');
  throw new Error('Terdapat beberapa output mint. Gunakan --mint <ADDRESS>.');
}

function loadPhases(dir) {
  const phases = {};
  for (let i = 1; i <= 12; i++) phases[i] = readJson(path.join(dir, `phase${i}-result.json`));
  if (!phases[11]) throw new Error('phase11-result.json tidak ditemukan.');
  return phases;
}

function phaseStatusClass(status) {
  const s = String(status || 'UNKNOWN').toUpperCase();
  if (s === 'COMPLETE' || s === 'VALID') return 'ok';
  if (s === 'PARTIAL' || s === 'SAMPLED' || s === 'WARNING') return 'warn';
  if (s === 'FAILED' || s === 'INVALID') return 'bad';
  return 'muted';
}

function pill(status) {
  const text = String(status ?? 'UNKNOWN');
  return `<span class="pill ${phaseStatusClass(text)}">${esc(text)}</span>`;
}

function copyWallet(address) {
  if (!address) return 'N/A';
  return `<button class="wallet" data-copy="${esc(address)}" title="Klik untuk menyalin alamat penuh">${esc(short(address, 5))}</button>`;
}

function copySignature(signature) {
  if (!signature) return 'N/A';
  return `<button class="sig" data-copy="${esc(signature)}" title="Klik untuk menyalin signature">${esc(short(signature, 10))}</button>`;
}

function renderScoreHeader(p11) {
  const s = safeObject(p11.summary);
  // IMPORTANT: never interpolate classification/confidence objects directly.
  const classification = safeObject(s.classification);
  const confidence = safeObject(s.confidence);
  const coverage = safeObject(s.coverage);
  const gate = safeObject(s.score_gate);
  const score = s.final_quality_score ?? 'N/A';
  const label = classification.label || p11.final_report?.headline || 'Tidak tersedia';
  const confidenceLevel = confidence.level || confidence.label || 'UNKNOWN';
  const confidenceScore = confidence.score;
  // Ronde 15 (P0): headline selalu bertiga — skor + confidence + % rule
  // terevaluasi — dan status PROVISIONAL dari gerbang cakupan selalu tampak.
  // Ronde 17 (P1): skor tandingan tanpa DB + status fee_utility eksplisit.
  const variants = safeObject(s.score_variants);
  const withoutDb = safeObject(variants.without_db);
  const feeStatus = safeObject(s.fee_utility_status);
  return {
    score, label, confidenceLevel, confidenceScore,
    ruleEvaluatedPct: coverage.phase9_rule_evaluated_pct ?? null,
    provisional: gate.provisional === true,
    gateReasons: safeArray(gate.reasons),
    gateTierCap: gate.tier_cap ?? null,
    withoutDbScore: withoutDb.score ?? null,
    withoutDbLabel: safeObject(withoutDb.classification).label || null,
    dbDelta: variants.db_delta_points ?? null,
    feeNotUsed: feeStatus.status === 'NOT_USED',
    feeClassification: feeStatus.classification || null,
    feeSourceScore: feeStatus.source_score ?? null,
  };
}

function renderExplainability(p11) {
  const ex = safeObject(p11.score_explainability);
  const ledger = safeArray(ex.ledger);
  const rows = ledger.map(d => `
    <tr>
      <td>${esc(d.label || d.dimension)}</td>
      <td>${esc(d.phase ?? 'N/A')}</td>
      <td>${num(d.weight, 0)}</td>
      <td>${d.available ? num(d.score, 2) : '<b>N/A</b>'}</td>
      <td>${d.available ? num(d.weighted_contribution, 2) : '—'}</td>
      <td>${pill(d.contribution_status || (d.available ? 'INCLUDED' : 'EXCLUDED'))}</td>
      <td>${esc(d.reason || 'N/A')}</td>
    </tr>`).join('');
  return `
  <section class="card">
    <div class="callout"><b>Formula:</b> ${esc(ex.formula || 'Tidak tersedia')}</div>
    <div class="grid grid-4">
      <div class="metric"><span>Weighted Sum</span><b>${num(ex.weighted_sum, 2)}</b></div>
      <div class="metric"><span>Available Weight</span><b>${num(ex.available_weight, 2)}</b></div>
      <div class="metric"><span>Raw Score</span><b>${num(ex.raw_score, 4)}</b></div>
      <div class="metric"><span>Final Score</span><b>${num(ex.final_score, 0)}</b></div>
    </div>
    <p class="subtle">Denominator: ${esc(ex.denominator_policy || 'N/A')}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Dimension</th><th>Phase</th><th>Weight</th><th>Score</th><th>Contribution</th><th>Status</th><th>Reason</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="empty">Ledger explainability tidak tersedia.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

function renderPhaseStatus(phases) {
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const p = phases[i];
    if (!p) continue;
    const status = p?.status || 'MISSING';
    const generated = p?.generated_at || p?.timestamp || null;
    rows.push(`<tr><td>${i}</td><td>phase${i}-result.json</td><td>${pill(status)}</td><td>${formatWIB(generated)}</td></tr>`);
  }
  return `<section class="card"><div class="table-wrap"><table>
    <thead><tr><th>Phase</th><th>Artifact</th><th>Status</th><th>Generated</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>
  <div class="callout"><b>Coverage rule:</b> PARTIAL, SAMPLED, UNKNOWN, dan INSUFFICIENT_DATA tidak otomatis diperlakukan sebagai negative finding.</div>
  </section>`;
}

function renderRisk(p9, p10) {
  const rules = safeArray(p9?.rules);
  const groups = safeArray(p10?.evidence_groups);
  const triggered = rules.filter(r => String(r.status).toUpperCase() === 'TRIGGERED');
  const rows = triggered.map(r => `<tr>
    <td>${esc(r.rule_id)}</td><td>${esc(r.category)}</td><td>${esc(r.name)}</td><td>${pill(r.status)}</td>
    <td>${esc(r.reason || 'N/A')}</td>
    <td>${safeArray(r.evidence_refs).length}</td>
  </tr>`).join('');
  const groupDetails = groups.map(g => {
    const risk = safeObject(g.risk);
    // Phase 10 groups carry evidence as `evidence_identities` (+ legacy `source_refs`);
    // they never had an `evidence_refs` field, which rendered as "Evidence refs: 0".
    const refs = safeArray(g.evidence_identities?.length ? g.evidence_identities : g.source_refs);
    return `<details><summary>${esc(g.category || 'Evidence Group')} · ${esc(g.wallet ? short(g.wallet, 5) : 'N/A')} · Risk ${num(risk.score, 0)}</summary>
      <div class="detail-body"><p><b>Wallet:</b> ${copyWallet(g.wallet)}</p>
      <p><b>Member rules:</b> ${safeArray(g.member_rule_ids).map(esc).join(', ') || 'N/A'}</p>
      <p><b>Evidence refs:</b> ${refs.length}</p>
      ${refs.slice(0, 12).map(x => `<div class="evidence-row">${copySignature(typeof x === 'string' ? x.replace(/^sig:/, '') : x?.signature)}</div>`).join('')}
      </div></details>`;
  }).join('');
  return `<section class="card">
    <div class="grid grid-4">
      <div class="metric"><span>Rules</span><b>${num(p9?.summary?.rules_total, 0)}</b></div>
      <div class="metric"><span>Triggered</span><b>${num(p9?.summary?.triggered, 0)}</b></div>
      <div class="metric"><span>Provisional</span><b>${num(p9?.summary?.provisional, 0)}</b></div>
      <div class="metric"><span>Insufficient</span><b>${num(p9?.summary?.insufficient_data, 0)}</b></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Rule</th><th>Category</th><th>Name</th><th>Status</th><th>Reason</th><th>Evidence refs</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" class="empty">Tidak ada rule TRIGGERED.</td></tr>'}</tbody></table></div>
    <h3>Evidence Groups</h3>${groupDetails || '<div class="empty">Tidak ada evidence group.</div>'}
  </section>`;
}

function walletMapFromPhase10(p10) {
  const m = new Map();
  for (const w of safeArray(p10?.wallet_scores)) if (w?.wallet) m.set(w.wallet, w);
  return m;
}

function baMapFromPhase10(p10) {
  const m = new Map();
  for (const w of safeArray(p10?.wallet_intelligence?.wallets)) if (w?.wallet) m.set(w.wallet, w);
  return m;
}

function renderWallets(p8, p10) {
  const scores = walletMapFromPhase10(p10);
  const ba = baMapFromPhase10(p10);
  const wallets = safeArray(p8?.wallets);
  const cards = wallets.map(w => {
    const a = scores.get(w.wallet) || {};
    const b = ba.get(w.wallet) || {};
    const risk = safeObject(a.risk);
    const ev = safeObject(a.evidence_strength);
    const adj = safeObject(b.behavior_adjustment);
    const current = safeObject(w.current);
    const history = safeObject(w.history);
    const role = safeArray(w.database?.roles).join(', ') || 'DEFAULT/UNKNOWN';
    const riskText = risk.score !== undefined && risk.score !== null ? `${num(risk.score, 0)} · ${esc(risk.label || '')}` : 'N/A';
    const evText = ev.score !== undefined && ev.score !== null ? `${num(ev.score, 0)} · ${esc(ev.label || '')}` : 'N/A';
    return `<details class="wallet-card">
      <summary>${copyWallet(w.wallet)} <span class="wallet-meta">${esc(role)} · ${esc(current.classification || 'UNKNOWN')}</span></summary>
      <div class="detail-body">
        <div class="grid grid-4">
          <div><span class="subtle">Balance</span><br><b>${num(current.balance_ui, 6)}</b></div>
          <div><span class="subtle">Supply</span><br><b>${num(current.supply_percentage, 4)}%</b></div>
          <div><span class="subtle">Risk</span><br><b>${riskText}</b></div>
          <div><span class="subtle">Evidence</span><br><b>${evText}</b></div>
        </div>
        <p><b>Database roles:</b> ${esc(role)} · <b>DB weight:</b> ${num(w.database?.total_database_weight, 0)}</p>
        <p><b>History:</b> ${pill(history.coverage?.status || history.status || 'UNKNOWN')} · events ${num(history.events_detected,0)} · pages ${num(history.pages,0)}</p>
        <p><b>Behavior Adjustment:</b> ${adj.score !== undefined && adj.score !== null ? `${num(adj.score,2)} (${esc(adj.status || '')})` : `N/A (${esc(adj.status || 'INSUFFICIENT_DATA')})`}</p>
      </div>
    </details>`;
  }).join('');
  const total = wallets.length;
  const riskCount = wallets.filter(w => { const r=scores.get(w.wallet)?.risk?.score; return Number.isFinite(Number(r)); }).length;
  const baAvailable = wallets.filter(w => ['AVAILABLE','PARTIAL'].includes(String(ba.get(w.wallet)?.behavior_adjustment?.status || '').toUpperCase())).length;
  return `<section class="card">
    <div class="grid grid-4">
      <div class="metric"><span>Wallets</span><b>${total}</b></div>
      <div class="metric"><span>Risk score</span><b>${riskCount}</b></div>
      <div class="metric"><span>BA available/partial</span><b>${baAvailable}</b></div>
      <div class="metric"><span>History complete</span><b>${num(p8?.summary?.complete_histories,0)}</b></div>
    </div>
    <p class="subtle">Alamat wallet ditampilkan 5 karakter pertama. Klik wallet untuk menyalin alamat penuh.</p>
    ${cards || '<div class="empty">Tidak ada wallet.</div>'}
  </section>`;
}

function renderLineage(phases, dir) {
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const file = path.join(dir, `phase${i}-result.json`);
    if (!fs.existsSync(file)) continue;
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    rows.push(`<tr><td>${i}</td><td>phase${i}-result.json</td><td><code>${sha}</code></td><td>${pill(phases[i]?.status || 'MISSING')}</td></tr>`);
  }
  return `<section class="card"><div class="callout"><b>Source-of-truth:</b> phase result JSON. Report layer hanya memformat dan menampilkan data; tidak menghitung ulang score atau mengubah status coverage.</div>
  <div class="table-wrap"><table><thead><tr><th>Phase</th><th>Artifact</th><th>SHA-256</th><th>Status</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
  <p class="subtle">SHA-256 setiap artifact memungkinkan verifikasi bahwa report berasal dari file phase yang sama.</p></section>`;
}

function renderPhase12(p12) {
  if (!p12) return '<section class="card"><div class="empty">Phase 12 belum dijalankan untuk mint ini.</div></section>';
  const v = safeObject(p12.verdict);
  const checklist = safeArray(p12.rug_checklist).map(i =>
    `<tr><td>${esc(i.label)}</td><td>${pill(i.status)}</td><td>${esc(i.detail || 'N/A')}</td></tr>`).join('');
  const birds = safeObject(p12.early_birds);
  const birdRows = safeArray(birds.early_birds).slice(0, 15).map(b =>
    `<tr><td>${copyWallet(b.wallet)}</td><td>${num(b.first_acquisition_minutes_after_launch, 1)} mnt</td><td>${b.still_holding ? 'Ya' : 'Tidak'}</td><td>${num(b.sell_count, 0)}</td></tr>`).join('');
  const bundlers = safeArray(birds.bundler_candidates).map(c =>
    `<div class="evidence-row"><b>${c.wallet_count} wallet</b> · ${esc(c.cluster_key || '')} <span class="subtle">${esc(c.note || '')}</span></div>`).join('');
  const social = safeObject(p12.social);
  return `<section class="card">
    <div class="callout"><b>Verdict: ${esc(v.verdict || 'N/A')}</b><br><span class="subtle">${esc(v.disclaimer || '')}</span></div>
    <div class="grid grid-4">
      <div class="metric"><span>PASS</span><b>${num(v.counts?.PASS, 0)}</b></div>
      <div class="metric"><span>WARN</span><b>${num(v.counts?.WARN, 0)}</b></div>
      <div class="metric"><span>FAIL</span><b>${num(v.counts?.FAIL, 0)}</b></div>
      <div class="metric"><span>UNKNOWN</span><b>${num(v.counts?.UNKNOWN, 0)}</b></div>
    </div>
    <ul>${safeArray(v.reasons).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <h3>Rug Checklist</h3>
    <div class="table-wrap"><table><thead><tr><th>Item</th><th>Status</th><th>Detail</th></tr></thead><tbody>${checklist}</tbody></table></div>
    <h3>Early Birds (${num(birds.early_bird_count, 0)} dalam ${num(birds.early_window_minutes, 0)} menit pertama)</h3>
    <div class="subtle">Masih holding: ${num(birds.early_birds_still_holding, 0)} · Launch: ${esc(birds.launch_time_iso || 'N/A')}</div>
    ${birdRows ? `<div class="table-wrap"><table><thead><tr><th>Wallet</th><th>Akuisisi pertama</th><th>Holding</th><th>Sell</th></tr></thead><tbody>${birdRows}</tbody></table></div>` : '<div class="empty">Tidak ada early bird terdeteksi dalam window.</div>'}
    <h3>Kandidat Bundler</h3>${bundlers || '<div class="empty">Tidak ada kandidat.</div>'}
    <h3>Sinyal Sosial</h3><div class="subtle">Status: ${esc(social.status || 'N/A')}${social.heat ? ` · Heat: ${esc(social.heat)}` : ''} · ${esc(social.disclaimer || social.note || '')}</div>
  </section>`;
}

function renderComparison(dir) {
  // P2: perbandingan antar-scan — hanya tampil bila ada arsip history/.
  // Kegagalan membaca arsip TIDAK boleh menggagalkan report utama.
  let cmp = null;
  try { cmp = buildComparison(dir); } catch { cmp = null; }
  if (!cmp) return '';
  const { previous: pv, current: cu, delta: d } = cmp;
  const fmt = v => (v === null || v === undefined ? '—' : esc(v));
  const dl = v => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${esc(v)}`);
  const row = (label, a, b, delta) => `<tr><td>${esc(label)}</td><td>${fmt(a)}</td><td>${fmt(b)}</td><td>${dl(delta)}</td></tr>`;
  const pillCls = cmp.marker.code === 'PERBAIKAN_KONSISTEN' ? 'ok'
    : cmp.marker.code === 'KEMUNGKINAN_ARTEFAK_SEPI' || cmp.marker.code === 'PERBURUKAN_KONSISTEN' ? 'warn' : 'muted';
  const ruleRows = cmp.rule_changes.length
    ? cmp.rule_changes.map(c => `<tr><td><code>${esc(c.rule)}</code></td><td>${esc(c.from)}</td><td>${esc(c.to)}</td></tr>`).join('')
    : '<tr><td colspan="3">Tidak ada rule yang berubah status.</td></tr>';
  const pools = cmp.pool_changes
    ? `<p class="subtle">Pool: ${cmp.pool_changes.common} sama di kedua scan · ${cmp.pool_changes.added.length} baru · ${cmp.pool_changes.removed.length} hilang.</p>` : '';
  const notes = cmp.notes.length
    ? `<div class="callout">${cmp.notes.map(n => esc(n)).join('<br>')}</div>` : '';
  return `
<h2>Perbandingan Antar-Scan (P2)</h2>
<p class="subtle">Dibandingkan dengan scan sebelumnya (arsip <code>history/${esc(cmp.previous_archive)}</code>${pv.generated_at ? `, dibuat ${formatWIB(pv.generated_at)}` : ''}).</p>
<div style="margin:8px 0"><span class="pill ${pillCls}">${esc(cmp.marker.label)}</span></div>
<div class="table-wrap"><table><tr><th>Ukuran</th><th>Sebelumnya</th><th>Sekarang</th><th>Delta</th></tr>
${row('Skor akhir (dengan DB)', pv.score, cu.score, d.score)}
${row('Skor tanpa DB', pv.score_no_db, cu.score_no_db, d.score_no_db)}
${row('Confidence', pv.confidence, cu.confidence, d.confidence)}
${row('Rule terevaluasi %', pv.rule_evaluated_pct, cu.rule_evaluated_pct, d.rule_evaluated_pct)}
${row('Rule TRIGGERED', pv.counts.triggered, cu.counts.triggered, d.triggered)}
${row('Rule INSUFFICIENT_DATA', pv.counts.insufficient, cu.counts.insufficient, d.insufficient)}
${row('Dimensi risk_findings', pv.dims.risk_findings, cu.dims.risk_findings, d.risk_findings_dim)}
${row('DB match (wallet)', pv.db.matched, cu.db.matched, d.db_matched)}
${row('Total bobot DB', pv.db.total_weight, cu.db.total_weight, d.db_total_weight)}
${row('Retensi DB', pv.db.retention, cu.db.retention, d.db_retention)}
${row('Wallet ter-scan (Phase 8)', pv.p8.scanned, cu.p8.scanned, d.p8_scanned)}
${row('Histori lengkap (Phase 8)', pv.p8.complete, cu.p8.complete, d.p8_complete)}
</table></div>
<h3>Rule yang berubah status</h3>
<div class="table-wrap"><table><tr><th>Rule</th><th>Sebelumnya</th><th>Sekarang</th></tr>${ruleRows}</table></div>
${pools}${notes}`;
}

function buildHtml(phases, mint, dir) {
  const p11 = phases[11], p8 = phases[8], p9 = phases[9], p10 = phases[10], p12 = phases[12];
  const header = renderScoreHeader(p11);
  const context = readJson(path.join(dir, 'scan-context.json')) || {};
  const generated = p11.generated_at || p11.timestamp || new Date().toISOString();
  const started = context.started_at || p11.input?.started_at || null;
  const phaseCount = Object.values(phases).filter(Boolean).length;
  const validation = p11.provenance?.validation_status || 'UNKNOWN';
  const classification = safeObject(p11.summary?.classification);
  const confidence = safeObject(p11.summary?.confidence);
  const coverage = safeObject(p11.summary?.coverage);
  const dataQuality = safeObject(p11.summary?.data_quality);
  const limitations = safeArray(p11.limitations);

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>STI Report — ${esc(mint)}</title>
<style>
:root{--bg:#fff;--text:#171717;--muted:#6b7280;--line:#e5e7eb;--soft:#f7f7f5;--blue:#5b6472;--ok:#3f6b52;--warn:#8a6d3b;--bad:#8a4b4b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}.container{max-width:1180px;margin:auto;padding:32px 18px 60px}.header{border-bottom:1px solid var(--line);padding-bottom:22px}.eyebrow{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700}.header h1{font-size:36px;line-height:1.15;margin:8px 0}.mint{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;word-break:break-all}.subtle{font-size:12px;color:var(--muted)}h2{font-size:20px;margin:30px 0 12px}h3{font-size:15px;margin:18px 0 10px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.grid-4{grid-template-columns:repeat(4,1fr)}.card{border:1px solid var(--line);border-radius:12px;padding:16px;background:#fff}.hero{margin-top:18px}.score{font-size:58px;font-weight:750;line-height:1;margin:8px 0}.score small{font-size:22px;color:var(--muted)}.classification{font-weight:650}.metric{border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--soft)}.metric span{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.metric b{font-size:20px}.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:.03em}.pill.ok{color:var(--ok);background:#f4f8f5}.pill.warn{color:var(--warn);background:#faf8f1}.pill.bad{color:var(--bad);background:#fbf5f5}.pill.muted{color:var(--muted);background:#f7f7f7}.callout{border-left:3px solid var(--blue);background:var(--soft);padding:12px 14px;margin:12px 0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--line);vertical-align:top}th{background:var(--soft);font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}code{font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;word-break:break-all}.wallet,.sig{border:0;background:none;padding:0;font:inherit;font-family:ui-monospace,SFMono-Regular,monospace;color:var(--blue);cursor:pointer}.wallet:hover,.sig:hover{text-decoration:underline}.sig{font-size:11px}.empty{padding:18px;color:var(--muted);border:1px dashed var(--line);border-radius:10px}details{border:1px solid var(--line);border-radius:10px;margin:8px 0;background:#fff}summary{cursor:pointer;padding:11px;font-weight:650}.detail-body{padding:0 12px 12px;border-top:1px solid var(--line)}.wallet-meta{font-weight:400;color:var(--muted);font-size:12px;margin-left:8px}.evidence-row{padding:4px 0}.footer{margin-top:34px;padding-top:15px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}@media(max-width:800px){.grid,.grid-4{grid-template-columns:1fr}.container{padding:22px 12px}.score{font-size:48px}}
</style></head><body><div class="container">
<header class="header"><div class="eyebrow">Solana Token Intelligence · Final Report</div>
<h1>${esc(header.label)} · ${esc(header.score)}/100</h1><div class="mint">${esc(mint)}</div>
<div class="subtle">Run ID: ${esc(p11.run_id || context.run_id || 'N/A')} · Dibuat: ${formatWIB(generated)}</div></header>

<div class="grid"><section class="card hero"><div class="eyebrow">Final Classification</div><div class="score">${esc(header.score)}<small>/100</small></div>
<div class="classification">${esc(header.label)} · Confidence ${esc(header.confidenceLevel)}${header.confidenceScore !== undefined ? ` <span class="subtle">(${num(header.confidenceScore,2)}/100)</span>` : ''} · Rule terevaluasi ${header.ruleEvaluatedPct !== null && header.ruleEvaluatedPct !== undefined ? `${num(header.ruleEvaluatedPct,2)}%` : 'N/A'}</div>
${header.provisional ? `<div style="margin-top:8px"><span class="pill warn">PROVISIONAL — gerbang cakupan P0: tier dibatasi maks ${esc(header.gateTierCap ?? '')} (${esc(header.gateReasons.join(', '))}). Skor mentah tidak diubah.</span></div>` : ''}
${header.withoutDbScore !== null && header.withoutDbScore !== undefined ? `<div class="subtle" style="margin-top:6px">Dua sumbu sinyal (P1): skor resmi <b>dengan DB ${esc(header.score)}/100</b> · skor tandingan <b>tanpa DB ${esc(header.withoutDbScore)}/100</b>${header.withoutDbLabel ? ` (${esc(header.withoutDbLabel)})` : ''} · delta DB ${header.dbDelta === null || header.dbDelta === undefined ? 'N/A' : `${header.dbDelta >= 0 ? '+' : ''}${esc(header.dbDelta)} poin`}. Skor tanpa DB = on-chain murni, sebelum adjustment kerumunan wallet DB.</div>` : ''}
${header.feeNotUsed ? `<div class="subtle" style="margin-top:4px">Dimensi fee_utility <b>tidak dipakai</b> untuk token ini (klasifikasi Phase 6: ${esc(header.feeClassification || 'UNKNOWN')}; skor sumber ${header.feeSourceScore === null || header.feeSourceScore === undefined ? 'N/A' : esc(header.feeSourceScore)} tercatat sebagai bukti, bukan skor).</div>` : ''}
<div class="subtle">Score hanya merefleksikan dimensi yang tersedia; dimensi unavailable tidak dimasukkan ke denominator.</div></section>
<section class="card"><h3>Scan Context</h3><table><tr><td>Mode</td><td>${esc(context.mode || 'N/A')}</td></tr><tr><td>Started</td><td>${formatWIB(started)}</td></tr><tr><td>Phase tersedia</td><td>${phaseCount}/11</td></tr><tr><td>Validation</td><td>${pill(validation)}</td></tr></table></section></div>

${renderComparison(dir)}
<h2>Score Explainability</h2>${renderExplainability(p11)}
<h2>Coverage & Phase Status</h2>${renderPhaseStatus(phases)}
<h2>Risk & Evidence</h2>${renderRisk(p9,p10)}
<h2>Wallet Intelligence</h2>${renderWallets(p8,p10)}
<h2>Early-Trader Signals (Phase 12)</h2>${renderPhase12(p12)}
<h2>Data Quality & Limitations</h2><section class="card"><div class="grid grid-4">
<div class="metric"><span>Coverage</span><b>${num(coverage.score,2)}%</b></div><div class="metric"><span>Dimension coverage</span><b>${num(coverage.dimension_coverage_pct,2)}%</b></div><div class="metric"><span>Scoring support confidence</span><b>${esc(confidence.level || confidence.label || 'UNKNOWN')}</b></div><div class="metric"><span>Data quality assessment</span><b>${esc(dataQuality.assessment || 'NOT_AVAILABLE')}</b></div></div>
<div class="callout"><b>Semantics:</b> Scoring Support Confidence dan Data Quality Assessment dipisahkan. Data Quality tidak diberi skor 0–100 pada Stage 6M karena model numeriknya belum empirically validated. Phase presence hanya berarti artifact tersedia, bukan COMPLETE coverage.</div>
<ul>${limitations.map(x => `<li>${esc(x)}</li>`).join('') || '<li>Tidak ada limitation tambahan.</li>'}</ul></section>
<h2>Source Lineage</h2>${renderLineage(phases,dir)}
<footer class="footer">STI HTML Report Generator · source-of-truth = phase result JSON · timestamps displayed in WIB (UTC+7) · report generation does not modify scoring.</footer>
</div><script>document.querySelectorAll('[data-copy]').forEach(el=>{el.addEventListener('click',async()=>{const v=el.getAttribute('data-copy');try{await navigator.clipboard.writeText(v);const old=el.textContent;el.textContent='Copied ✓';setTimeout(()=>el.textContent=old,900)}catch{window.prompt('Salin nilai:',v)}})});</script></body></html>`;
}

function generateReportHTML(mint, outputDir = null) {
  const target = outputDir ? { mint, dir: outputDir } : locateMint(mint);
  const phases = loadPhases(target.dir);
  const html = buildHtml(phases, target.mint, target.dir);
  const out = path.join(target.dir, 'report.html');
  fs.writeFileSync(out, html, 'utf8');
  // P2: simpan juga perbandingan antar-scan sebagai JSON mandiri
  // (tidak menggagalkan report bila arsip tidak terbaca).
  try {
    const cmp = buildComparison(target.dir);
    if (cmp) fs.writeFileSync(path.join(target.dir, 'scan-comparison.json'), JSON.stringify(cmp, null, 2) + '\n', 'utf8');
  } catch {}
  return { out, bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex') };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const mi = args.indexOf('--mint');
  const mint = mi >= 0 ? args[mi + 1] : null;
  try {
    const result = generateReportHTML(mint);
    console.log(`HTML report disimpan: ${result.out}`);
    console.log(`SHA-256: ${result.sha256}`);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { generateReportHTML, buildHtml, renderScoreHeader, formatWIB };
