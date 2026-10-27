'use strict';
/* scan_compare.js — P2 (roadmap 2026-10-20): perbandingan antar-scan.
 *
 * Membaca run saat ini di Output/<mint> dan run sebelumnya dari arsip
 * history/ terbaru (lihat scan_history.js), lalu menghitung delta yang
 * selama ini hanya bisa dibaca manual: skor, tier, rule berubah status,
 * cakupan evaluasi, dimensi, DB, dan perubahan himpunan pool.
 *
 * Penanda otomatis (kerangka yang disepakati bersama Rin):
 *   risiko turun + cakupan naik/tetap  -> PERBAIKAN KONSISTEN
 *   risiko turun + cakupan turun       -> KEMUNGKINAN ARTEFAK SEPI
 *   risiko naik  + cakupan naik/tetap  -> PERBURUKAN KONSISTEN
 * "Risiko" dibaca dari jumlah rule TRIGGERED dan skor dimensi
 * risk_findings (yang sudah dibalik: naik = risiko turun).
 * Murni pembacaan — tidak mengubah Phase 9/11 sama sekali.
 */
const fs = require('fs');
const path = require('path');
const { latestHistoryDir, readJsonSafe } = require('./scan_history');
const { computeTotalFromMatches } = require('./compute_db_benchmark');

function summarizeRun(dir) {
  const p11 = readJsonSafe(path.join(dir, 'phase11-result.json'));
  if (!p11?.summary) return null;
  const p9 = readJsonSafe(path.join(dir, 'phase9-result.json'));
  const p7 = readJsonSafe(path.join(dir, 'phase7-result.json'));
  const p8 = readJsonSafe(path.join(dir, 'phase8-result.json'));
  const s = p11.summary;
  const ruleStatuses = {};
  for (const r of (p9?.rules || [])) if (r?.rule_id) ruleStatuses[r.rule_id] = r.status;
  const counts = { triggered: 0, not_triggered: 0, insufficient: 0 };
  for (const st of Object.values(ruleStatuses)) {
    if (st === 'TRIGGERED') counts.triggered++;
    else if (st === 'NOT_TRIGGERED') counts.not_triggered++;
    else if (st === 'INSUFFICIENT_DATA') counts.insufficient++;
  }
  const dims = {};
  for (const d of (p11.score_breakdown || [])) dims[d.id] = d.available ? d.score : null;
  const dbt = Array.isArray(p7?.matches) ? computeTotalFromMatches(p7.matches) : null;
  const riskDim = (p11.score_breakdown || []).find(d => d.id === 'risk_findings');
  return {
    generated_at: p11.generated_at || null,
    score: s.final_quality_score ?? null,
    tier: s.classification?.tier ?? null,
    label: s.classification?.label ?? null,
    provisional: s.score_gate?.provisional === true,
    score_no_db: s.score_variants?.without_db?.score ?? null,
    confidence: s.confidence?.score ?? null,
    rule_evaluated_pct: s.coverage?.phase9_rule_evaluated_pct ?? null,
    counts,
    rule_statuses: ruleStatuses,
    dims,
    fee_status: s.fee_utility_status?.status || null,
    db: {
      matched: dbt ? dbt.matched : null,
      total_weight: dbt ? dbt.total : null,
      retention: riskDim?.details?.db_adjustment?.metrics?.retention?.rate ?? null,
    },
    p8: {
      scanned: p8?.summary?.wallets_scanned ?? null,
      complete: p8?.summary?.complete_histories ?? null,
    },
  };
}

function poolSet(dir) {
  const p4 = readJsonSafe(path.join(dir, 'phase4-result.json'));
  const pools = p4?.liquidity_mapping?.significant_pools;
  if (!Array.isArray(pools)) return null;
  return new Set(pools.map(p => p?.pool).filter(Boolean));
}

function buildComparison(mintDir) {
  const prevDir = latestHistoryDir(mintDir);
  if (!prevDir) return null;
  const prev = summarizeRun(prevDir);
  const cur = summarizeRun(mintDir);
  if (!prev || !cur) return null;

  const ruleChanges = [];
  for (const [id, st] of Object.entries(cur.rule_statuses)) {
    const o = prev.rule_statuses[id];
    if (o && o !== st) ruleChanges.push({ rule: id, from: o, to: st });
  }
  ruleChanges.sort((a, b) => a.rule.localeCompare(b.rule));

  const num = (a, b) => (a !== null && a !== undefined && b !== null && b !== undefined) ? +(a - b).toFixed(2) : null;
  const delta = {
    score: num(cur.score, prev.score),
    score_no_db: num(cur.score_no_db, prev.score_no_db),
    confidence: num(cur.confidence, prev.confidence),
    rule_evaluated_pct: num(cur.rule_evaluated_pct, prev.rule_evaluated_pct),
    triggered: num(cur.counts.triggered, prev.counts.triggered),
    insufficient: num(cur.counts.insufficient, prev.counts.insufficient),
    risk_findings_dim: num(cur.dims.risk_findings, prev.dims.risk_findings),
    db_matched: num(cur.db.matched, prev.db.matched),
    db_total_weight: num(cur.db.total_weight, prev.db.total_weight),
    db_retention: num(cur.db.retention, prev.db.retention),
    p8_scanned: num(cur.p8.scanned, prev.p8.scanned),
    p8_complete: num(cur.p8.complete, prev.p8.complete),
  };

  const riskImproved = (delta.triggered !== null && delta.triggered < 0) ||
    (delta.risk_findings_dim !== null && delta.risk_findings_dim > 0);
  const riskWorsened = (delta.triggered !== null && delta.triggered > 0) ||
    (delta.risk_findings_dim !== null && delta.risk_findings_dim < 0);
  const covDown = delta.rule_evaluated_pct !== null && delta.rule_evaluated_pct < 0;
  let marker;
  if (riskImproved && !riskWorsened) {
    marker = covDown
      ? { code: 'KEMUNGKINAN_ARTEFAK_SEPI', label: 'Kemungkinan artefak sepi — risiko tampak turun, tetapi cakupan evaluasi juga turun; penurunan bisa berasal dari data yang lebih sepi, bukan perbaikan token.' }
      : { code: 'PERBAIKAN_KONSISTEN', label: 'Perbaikan konsisten — risiko turun sementara cakupan evaluasi naik atau tetap.' };
  } else if (riskWorsened && !riskImproved) {
    marker = covDown
      ? { code: 'PERBURUKAN_TERCAMPUR', label: 'Risiko naik dengan cakupan menurun — baca rincian per rule sebelum menyimpulkan.' }
      : { code: 'PERBURUKAN_KONSISTEN', label: 'Perburukan konsisten — risiko naik sementara cakupan evaluasi naik atau tetap.' };
  } else if (!riskImproved && !riskWorsened) {
    marker = { code: 'STABIL', label: 'Stabil — tidak ada perubahan risiko material antar-scan.' };
  } else {
    marker = { code: 'CAMPURAN', label: 'Campuran — sinyal risiko bergerak berlawanan arah; baca rincian per rule.' };
  }

  let poolChanges = null;
  const prevPools = poolSet(prevDir);
  const curPools = poolSet(mintDir);
  if (prevPools && curPools) {
    poolChanges = {
      common: [...curPools].filter(x => prevPools.has(x)).length,
      added: [...curPools].filter(x => !prevPools.has(x)),
      removed: [...prevPools].filter(x => !curPools.has(x)),
    };
  }

  const notes = [];
  if (prev.fee_status && cur.fee_status && prev.fee_status !== cur.fee_status) {
    notes.push(`Status fee_utility berubah antar-scan (${prev.fee_status} → ${cur.fee_status}): sebagian delta skor berasal dari perubahan model penilaian (M2 aktif mulai Ronde 19), bukan dari perubahan token.`);
  }
  if (prev.provisional !== cur.provisional) {
    notes.push(`Status PROVISIONAL berubah antar-scan (${prev.provisional} → ${cur.provisional}) — bandingkan juga skor mentah dan cakupannya, bukan hanya tier.`);
  }
  if (poolChanges && (poolChanges.added.length || poolChanges.removed.length)) {
    notes.push(`Himpunan pool berubah antar-scan (${poolChanges.added.length} pool baru, ${poolChanges.removed.length} pool hilang): perbandingan likuiditas LTR-02/03 hanya berlaku pada ${poolChanges.common} pool yang ada di kedua scan.`);
  }

  return {
    version: 'p2-scan-compare-v1',
    previous_archive: path.basename(prevDir),
    previous: prev,
    current: cur,
    delta,
    rule_changes: ruleChanges,
    marker,
    pool_changes: poolChanges,
    notes,
  };
}

module.exports = { buildComparison, summarizeRun };
