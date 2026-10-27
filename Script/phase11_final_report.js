#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { computeDbConviction, applyDbAdjustments, loadDbConvictionSection } = require('./db_conviction_metrics');
const ROOT = __dirname;
const OUT_ROOT = path.join(ROOT, '..', 'Output'); // Project output folder is Output/ (capital O).
const VERSION = '1.2.0-6M';
const TIERS = [
  {min:1,max:20,tier:1,label:'Sangat lemah'},
  {min:21,max:40,tier:2,label:'Lemah'},
  {min:41,max:60,tier:3,label:'Sedang'},
  {min:61,max:80,tier:4,label:'Kuat'},
  {min:81,max:100,tier:5,label:'Sangat kuat'}
];
const DIMENSIONS = [
  {id:'token_control',label:'Kontrol token & authority',phase:2,weight:20},
  {id:'holder_distribution',label:'Distribusi holder',phase:4,weight:20},
  {id:'creator_activity',label:'Aktivitas creator',phase:5,weight:15},
  {id:'fee_utility',label:'Ekonomi & utilitas fee',phase:6,weight:10},
  {id:'risk_findings',label:'Temuan risiko Phase 9–10',phase:10,weight:25},
];
const readJson = f => { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return null; } };
const round = (n,d=2) => { const p=10**d; return Math.round((n+Number.EPSILON)*p)/p; };
const clamp = (n,min=1,max=100) => Math.max(min,Math.min(max,n));
const pct = n => `${round(n,1)}%`;
function tierFor(score){
  // Weighted averages can be fractional (e.g. 20.5), while tier bands are integer-based.
  // Classify using the nearest integer so no fractional score falls between tiers.
  const n = Math.max(1, Math.min(100, Math.round(Number(score))));
  return TIERS.find(t=>n>=t.min&&n<=t.max)||TIERS[TIERS.length-1];
}
// Ronde 15 (P0 roadmap, keputusan Rin 2026-10-20): GERBANG CAKUPAN.
// Formula skor TIDAK berubah (weighted mean atas dimensi yang tersedia).
// Gerbang hanya membatasi KLAIM klasifikasi: bila dimensi risk_findings
// tidak tersedia, atau rasio rule Phase 9 INSUFFICIENT_DATA melewati ambang,
// skor berstatus PROVISIONAL dan tier diplafon (bawaan: maks tier 3).
// Alasan: batch 1 realtime scan membuktikan data hilang menaikkan skor
// lewat renormalisasi (korelasi +0,65; kasus LouLou skor 81 dari data
// paling rusak). Angka mentah tetap ditampilkan apa adanya.
const SCORE_GATE_DEFAULTS = { enabled: true, max_insufficient_ratio: 1 / 3, tier_cap: 3 };
function loadScoreGateSection(){
  try {
    const c = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'Config', 'config.json'), 'utf8'));
    return (c && c.score_gate) || {};
  } catch { return {}; }
}
function resolveScoreGateConfig(section){
  const s = section && typeof section === 'object' ? section : {};
  const ratio = Number(s.max_insufficient_ratio);
  const cap = Number(s.tier_cap);
  return {
    enabled: s.enabled !== false,
    max_insufficient_ratio: Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : SCORE_GATE_DEFAULTS.max_insufficient_ratio,
    tier_cap: Number.isInteger(cap) && cap >= 1 && cap <= 5 ? cap : SCORE_GATE_DEFAULTS.tier_cap,
  };
}
function evaluateScoreGate({ tier, riskAvailable, insufficientCount, ruleTotal }, section){
  const cfg = resolveScoreGateConfig(section);
  const hasRatio = Number.isFinite(insufficientCount) && Number.isFinite(ruleTotal) && ruleTotal > 0;
  const ratio = hasRatio ? insufficientCount / ruleTotal : null;
  const reasons = [];
  if (cfg.enabled && tier && tier.tier !== null && tier.tier !== undefined) {
    if (riskAvailable === false) reasons.push('risk_findings_unavailable');
    if (ratio !== null && ratio > cfg.max_insufficient_ratio + 1e-9) reasons.push('insufficient_ratio_above_threshold');
  }
  const applied = reasons.length > 0;
  const cappedTierNum = applied ? Math.min(tier.tier, cfg.tier_cap) : (tier ? tier.tier : null);
  const cappedBand = cappedTierNum !== null && cappedTierNum !== undefined
    ? TIERS.find(t => t.tier === cappedTierNum) : null;
  return {
    version: 'p0-coverage-gate-v1',
    enabled: cfg.enabled,
    applied,
    provisional: applied,
    tier_cap: cfg.tier_cap,
    max_insufficient_ratio: cfg.max_insufficient_ratio,
    insufficient_rules: Number.isFinite(insufficientCount) ? insufficientCount : null,
    total_rules: Number.isFinite(ruleTotal) ? ruleTotal : null,
    insufficient_ratio: ratio !== null ? round(ratio, 4) : null,
    risk_findings_available: riskAvailable !== false,
    reasons,
    classification_before_gate: tier ? { tier: tier.tier ?? null, label: tier.label ?? null } : null,
    classification_after_gate: cappedBand ? { tier: cappedBand.tier, label: cappedBand.label } : null,
  };
}
function locateMint(mint){
  if(mint){const dir=path.join(OUT_ROOT,mint);return fs.existsSync(dir)?{mint,dir}:null;}
  const dirs=fs.existsSync(OUT_ROOT)?fs.readdirSync(OUT_ROOT,{withFileTypes:true}).filter(x=>x.isDirectory()):[];
  const found=dirs.map(d=>({mint:d.name,dir:path.join(OUT_ROOT,d.name)})).filter(x=>fs.existsSync(path.join(x.dir,'phase10-result.json')));
  if(found.length===1)return found[0];
  if(!found.length)throw Error('Tidak menemukan output Phase 10. Jalankan Phase 1–10 terlebih dahulu.');
  throw Error('Terdapat beberapa output mint. Gunakan --mint <ADDRESS>.');
}
function loadInputs(dir){const phases={};for(let i=1;i<=10;i++) phases[i]=readJson(path.join(dir,`phase${i}-result.json`)); if(!phases[10]) throw Error('phase10-result.json tidak ditemukan.');return phases;}
function loadScanContext(dir){return readJson(path.join(dir,'scan-context.json'));}
function phaseMint(r){return r?.input?.mint||r?.token?.mint||r?.summary?.mint||null;}
function hasNumericRisk(g){return g?.risk?.score!==null&&g?.risk?.score!==undefined&&g?.risk?.score!==''&&typeof g.risk.score==='number'&&Number.isFinite(g.risk.score);}
function phaseTimestamp(r){const raw=r?.generated_at||r?.timestamp||r?.provenance?.generated_at; if(!raw)return null;const n=Date.parse(raw);return Number.isFinite(n)?n:null;}
function validatePhaseInputs(phases, expectedMint, scanContext=null){
 const errors=[],warnings=[],seenRunIds=new Map(),timestamps=[],phaseSources=[];
 const contextRunId=scanContext?.run_id?String(scanContext.run_id).trim():null;
 const contextMint=scanContext?.mint?String(scanContext.mint).trim():null;
 if(scanContext && contextMint && contextMint!==expectedMint) errors.push(`SCAN_CONTEXT_MINT_MISMATCH: scan-context.json memuat mint ${contextMint}, target ${expectedMint}.`);
 if(scanContext && !contextRunId) warnings.push('SCAN_CONTEXT_RUN_ID_MISSING: scan-context.json tersedia tetapi tidak memiliki run_id yang valid.');
 for(let n=1;n<=10;n++){
  const r=phases[n]; if(!r){warnings.push(`PHASE_MISSING: phase${n}-result.json tidak tersedia.`);continue;}
  const actualMint=phaseMint(r);
  if(!actualMint) warnings.push(`PHASE_MINT_MISSING: Phase ${n} tidak mencantumkan mint pada metadata input.`);
  else if(actualMint!==expectedMint) errors.push(`PHASE_MINT_MISMATCH: Phase ${n} memuat mint ${actualMint}, target ${expectedMint}.`);
  if(r.run_id){const id=String(r.run_id).trim();if(!seenRunIds.has(id))seenRunIds.set(id,[]);seenRunIds.get(id).push(n); if(contextRunId && id!==contextRunId) errors.push(`RUN_ID_CONTEXT_MISMATCH: Phase ${n} memiliki run_id ${id}, berbeda dari scan-context.json (${contextRunId}).`);}
  else warnings.push(`RUN_ID_MISSING: Phase ${n} tidak memiliki run_id (hasil lama atau metadata tidak tersedia).`);
  const rawTimestamp=r.generated_at||r.timestamp||r.provenance?.generated_at||null;
  const ts=phaseTimestamp(r);if(ts!==null)timestamps.push({phase:n,ts,raw:rawTimestamp});
  else if(rawTimestamp) errors.push(`TIMESTAMP_INVALID: Phase ${n} memiliki timestamp yang tidak dapat diparse: ${String(rawTimestamp)}.`);
  else warnings.push(`TIMESTAMP_MISSING: Phase ${n} tidak memiliki timestamp (hasil lama atau metadata tidak tersedia).`);
  const provenancePhase=Number(r.provenance?.phase);
  if(r.provenance?.phase!==undefined && (!Number.isInteger(provenancePhase)||provenancePhase!==n)) errors.push(`PROVENANCE_PHASE_MISMATCH: Phase ${n} memiliki provenance.phase=${String(r.provenance?.phase)}.`);
  if(r.provenance?.mint && String(r.provenance.mint)!==expectedMint) errors.push(`PROVENANCE_MINT_MISMATCH: Phase ${n} memiliki provenance.mint ${String(r.provenance.mint)}, target ${expectedMint}.`);
  phaseSources.push({phase:n,source_file:`phase${n}-result.json`,status:r.status||'UNKNOWN',mint:actualMint,run_id:r.run_id||null,timestamp:rawTimestamp,provenance_phase:r.provenance?.phase??null});
 }
 if(seenRunIds.size>1){const detail=[...seenRunIds.entries()].map(([id,ns])=>`${id}: Phase ${ns.join(',')}`).join(' | ');errors.push(`RUN_ID_MISMATCH: Hasil fase berasal dari beberapa run_id (${detail}). Jalankan ulang pipeline 1–10 dalam satu rangkaian.`);}
 for(let i=1;i<timestamps.length;i++){
  const prev=timestamps[i-1],cur=timestamps[i];
  if(cur.ts<prev.ts) warnings.push(`TIMESTAMP_ORDER_WARNING: Phase ${cur.phase} dibuat sebelum Phase ${prev.phase}; input hilir mungkin stale. Periksa dan jalankan ulang fase terdampak.`);
 }
 if(contextRunId && seenRunIds.size===1 && !seenRunIds.has(contextRunId)) errors.push(`RUN_ID_CONTEXT_MISMATCH: Tidak ada Phase 1–10 yang menggunakan run_id scan-context.json (${contextRunId}).`);
 if(!seenRunIds.size) warnings.push('LEGACY_PROVENANCE: Tidak ada run_id pada hasil Phase 1–10; keseragaman satu rangkaian pemindaian tidak dapat dibuktikan.');
 return {valid:errors.length===0,errors,warnings,run_id:seenRunIds.size===1?[...seenRunIds.keys()][0]:null,context_run_id:contextRunId,context_mint:contextMint,phases_checked:Object.keys(phases).filter(k=>phases[k]).map(Number),timestamps_checked:timestamps.length,phase_sources:phaseSources};
}

function dimension(id,score,available,source,reason,details={}){return {id,label:DIMENSIONS.find(x=>x.id===id)?.label||id,weight:DIMENSIONS.find(x=>x.id===id)?.weight||0,score:available?round(clamp(score),2):null,available,source,reason,details};}
function scoreDimensions(p, opts = {}) {
 const p2=p[2],p4=p[4],p5=p[5],p6=p[6],p9=p[9],p10=p[10]||{};
 const authority=p2?.authority||{}; const mintStatus=String(authority.mint?.status||'UNKNOWN').toUpperCase(); const freezeStatus=String(authority.freeze?.status||'UNKNOWN').toUpperCase();
 let control=null,controlReason='Data authority tidak tersedia';
 if(p2){const map={REVOKED:100,NONE:100,UNKNOWN:50,ACTIVE:35,SET:35}; const a=map[mintStatus]??50,f=map[freezeStatus]??50; control=round((a+f)/2);controlReason=`Mint authority: ${mintStatus}; freeze authority: ${freezeStatus}.`}
 const conc=p4?.concentration?.adjusted_confirmed_normal||p4?.concentration?.raw||{}; const top10=Number(conc.top_10?.share_of_total_supply_pct);
 let holder=null,holderReason='Data konsentrasi holder tidak tersedia';
 if(Number.isFinite(top10)){holder=top10<20?90:top10<35?75:top10<50?60:top10<65?40:20;holderReason=`Top 10 holder (data yang tersedia): ${top10}% supply; skor memakai band baseline.`;}
 const creator=p5?.creator_events?.sell; let creatorScore=null,creatorReason='Data aktivitas sell creator tidak tersedia';
 // Phase 5 emits 'FOUND' (sell observed) or 'NO_SELL_OBSERVED_WITHIN_COVERAGE'.
 // Map those exact statuses; anything else stays neutral (50).
 if(creator&&creator.status){const st=String(creator.status).toUpperCase(); if(st==='FOUND'||Number(creator.sell_count)>0){creatorScore=20;creatorReason=`Sell creator terdeteksi (${creator.sell_count??'jumlah tidak tersedia'}); baseline memberi skor rendah.`;} else if(st==='NO_SELL_OBSERVED_WITHIN_COVERAGE'){creatorScore=65;creatorReason='Tidak ada sell creator yang terdeteksi dalam cakupan pemindaian; bukan bukti bahwa creator tidak menjual di luar cakupan.';} else {creatorScore=50;creatorReason=`Status sell creator ${st}; bukti belum cukup untuk penilaian lebih spesifik.`;}}
 const fee=p6?.fee_economic_assessment||p6?.fee_economics;
 let feeScore=null,feeReason='Data fee economics tidak tersedia',feeDetails={source_score:null,source_confidence:null,project_utility_verified:false,project_utility_evidence_status:'UNKNOWN',eligibility_status:'NOT_AVAILABLE',provenance:null};
 if(fee){
   const utilityVerified=fee?.project_utility_verified===true;
   const utilityStatus=String(fee?.project_utility_evidence_status||'UNKNOWN').toUpperCase();
   const n=Number(fee?.score);
   // Ronde 19 (P1 ditutup, keputusan Rin 2026-10-21): model M2 DIAKTIFKAN.
   // Eligibility diperluas: cukup SATU bukti penggunaan fee terverifikasi
   // (utilitas protokol / manfaat holder / buyback-burn / ekstraksi
   // creator) + skor sumber tersedia. Pemetaan NETRAL: dimensi =
   // clamp(50 + 5×skor) — skor -10..10 -> 0..100, titik tengah 50.
   // Simulasi 23 scan sebelum aktivasi: model lama (x10, gerbang sempit)
   // meloloskan 0/23; M2 mengubah 5 skor sebesar -1..-2 poin saja.
   // Tanpa bukti terverifikasi -> dimensi tetap dinyatakan TIDAK DIPAKAI
   // (deklarasi Ronde 17 tetap berlaku untuk kasus itu).
   const verifiedUses={
     protocol_utility:utilityVerified,
     holder_benefit:fee?.holder_benefit_verified===true,
     buyback_burn:fee?.buyback_burn_verified===true,
     creator_extraction:fee?.creator_extraction_verified===true,
   };
   const verifiedList=Object.entries(verifiedUses).filter(([,v])=>v).map(([k])=>k);
   const eligibleM2=verifiedList.length>0 && Number.isFinite(n);
   feeDetails={
     source_score:Number.isFinite(n)?n:null,
     source_confidence:fee?.confidence||'UNKNOWN',
     project_utility_verified:utilityVerified,
     project_utility_evidence_status:utilityStatus,
     verified_uses:verifiedUses,
     model:eligibleM2?'M2_NEUTRAL_50_PLUS_5X':null,
     eligibility_status:eligibleM2?'ELIGIBLE_M2':(utilityVerified?'ELIGIBLE':'NOT_AVAILABLE'),
     provenance:fee?.provenance||null
   };
   if(eligibleM2){
     feeScore=clamp(50 + n*5);
     feeReason=`Model M2 aktif (keputusan Rin 2026-10-21): bukti penggunaan fee terverifikasi [${verifiedList.join(', ')}]; skor sumber ${n} (skala -10..10) dipetakan netral 50 + 5×skor = ${feeScore}. Klasifikasi Phase 6: ${fee?.classification||'UNKNOWN'}; confidence sumber: ${fee.confidence||'UNKNOWN'}. Pemetaan ini baseline netral, belum dikalibrasi historis.`;
   }else{
     feeScore=null;
     // Ronde 17 (P1): alasan diperjelas — sebutkan klasifikasi Phase 6 dan
     // skor sumbernya. Dimensi ini TIDAK hilang diam-diam; ia dinyatakan
     // tidak dipakai (lihat summary.fee_utility_status).
     feeReason=`Economic utility ${utilityStatus} (klasifikasi Phase 6: ${fee?.classification||'UNKNOWN'}; skor sumber ${Number.isFinite(n)?n:'tidak tersedia'} pada skala -10..10); tidak ada bukti penggunaan fee terverifikasi (utilitas protokol/manfaat holder/buyback-burn/ekstraksi creator) — dimensi fee_utility dinyatakan TIDAK DIPAKAI untuk token ini dan tidak dimasukkan ke denominator Phase 11.`;
   }
 }
 const groups=Array.isArray(p10?.evidence_groups)?p10.evidence_groups:[]; const scoredGroups=groups.filter(hasNumericRisk);
 let riskScore=null,riskReason='Tidak ada skor risiko numerik yang dapat dipakai';
 if(scoredGroups.length){const vals=scoredGroups.map(g=>Number(g.risk.score)); const worst=Math.max(...vals); riskScore=clamp(100-worst);riskReason=`Dibalik dari risiko agregat tertinggi ${worst} (100 − risiko); bukan probabilitas dan belum dikalibrasi.`;}
 const present=Object.values(p).filter(Boolean).length; const expected=10; const p8=p[8]?.summary||{}; const p9s=p9?.summary||{}; const p9Total=Number(p9s.rules_total||0); const p9Evaluated=Number(p9s.triggered||0)+Number(p9s.provisional||0)+Number(p9s.not_triggered||0); const historyComplete=Number(p8.complete_histories??0); const historyTotal=Number(p8.wallets_scanned??0);
 let coverageScore=round((present/expected)*100); if(historyTotal>0) coverageScore=round(coverageScore*0.65+(historyComplete/historyTotal*100)*0.2+(p9Total? p9Evaluated/p9Total*100:0)*0.15);
 const coverageAvailable=present>0;
 const baseDims=[
  dimension('token_control',control,control!==null,'phase2.authority',controlReason,{mint_authority:mintStatus,freeze_authority:freezeStatus}),
  dimension('holder_distribution',holder,holder!==null,'phase4.concentration',holderReason,{top10_supply_pct:Number.isFinite(top10)?top10:null}),
  dimension('creator_activity',creatorScore,creatorScore!==null,'phase5.creator_events.sell',creatorReason,{status:creator?.status||null,sell_count:creator?.sell_count??null}),
  dimension('fee_utility',feeScore,feeScore!==null,'phase6.fee_economic_assessment',feeReason,feeDetails),
  dimension('risk_findings',riskScore,riskScore!==null,'phase10.evidence_groups[].risk',riskReason,{scored_groups:scoredGroups.length,highest_risk:scoredGroups.length?Math.max(...scoredGroups.map(g=>Number(g.risk.score))):null}),
 ];
 // Opsi B (keputusan Rin 2026-10-11): adjustment DB conviction terhubung ke tiap
 // dimensi. opts.dbConviction meng-override section config (untuk test); default
 // baca lenient dari Config/config.json. Tanpa data cukup -> dilewati, bukan nol.
 const dbSection = opts.dbConviction !== undefined ? opts.dbConviction : loadDbConvictionSection();
 const dbm = computeDbConviction({ matches:p[7]?.matches, wallets:p[8]?.wallets, p5:p[5], config:{ database_conviction: dbSection } });
 const adjusted = applyDbAdjustments(baseDims, dbm, { database_conviction: dbSection });
 // Ronde 17 (P1): simpan skor pra-adjustment per dimensi agar skor
 // tandingan tanpa DB bisa dihitung EKSAK (bukan rekonstruksi dari
 // total_points yang bisa terpotong clamp 0/100).
 return adjusted.map((d, i) => ({ ...d, details: { ...(d.details || {}), pre_db_score: baseDims[i] && baseDims[i].available ? baseDims[i].score : null } }));
}
function buildDataQualityAssessment(p, dims, confidenceMeta) {
 const phaseStatus = Object.fromEntries(Array.from({length:10},(_,i)=>{
   const n=i+1; return [n,String(p[n]?.status||'MISSING').toUpperCase()];
 }));
 const phaseStatusCounts={};
 for(const st of Object.values(phaseStatus)) phaseStatusCounts[st]=(phaseStatusCounts[st]||0)+1;
 const degradedPhases=Object.entries(phaseStatus).filter(([,st])=>['PARTIAL','SAMPLED','EMPTY','UNKNOWN','FAILED','MISSING'].includes(st)).map(([n,st])=>({phase:Number(n),status:st}));
 const p8=p[8]||{};
 const p8Summary=p8.summary||{};
 const selection=p8.wallet_selection||p8.config||{};
 const candidates=Number(selection.candidate_wallets ?? p8.config?.candidate_wallets ?? 0);
 const selected=Number(selection.selected_wallets ?? p8.config?.selected_wallets ?? p8Summary.wallets_selected ?? 0);
 const skipped=Number(selection.skipped_wallets ?? p8.config?.skipped_wallets ?? 0);
 const selectionComplete = candidates>0 ? (selected<=candidates && skipped===0 && selected===candidates) : null;
 const p9=p[9]||{};
 const p9Summary=p9.summary||{};
 const ruleTotal=Number(p9Summary.rules_total||0);
 const evaluated=Number(p9Summary.triggered||0)+Number(p9Summary.provisional||0)+Number(p9Summary.not_triggered||0);
 const ruleStatusCounts={};
 for(const r of (p9.rules||[])){const st=String(r.status||'UNKNOWN').toUpperCase();ruleStatusCounts[st]=(ruleStatusCounts[st]||0)+1;}
 const p10=p[10]||{};
 const groups=Array.isArray(p10.evidence_groups)?p10.evidence_groups:[];
 const evidenceScores=groups.map(g=>Number(g?.evidence_strength?.score)).filter(Number.isFinite);
 const evidenceSummary={
   groups_total:groups.length,
   groups_with_numeric_evidence_strength:evidenceScores.length,
   evidence_strength_min:evidenceScores.length?Math.min(...evidenceScores):null,
   evidence_strength_max:evidenceScores.length?Math.max(...evidenceScores):null,
   evidence_strength_average:evidenceScores.length?round(evidenceScores.reduce((a,b)=>a+b,0)/evidenceScores.length):null,
   note:'Evidence strength is evidence support quality, not final data-quality confidence and not probability.'
 };
 const excludedDimensions=dims.filter(d=>!d.available).map(d=>({id:d.id,label:d.label,weight:d.weight,reason:d.reason,details:d.details||{}}));
 const statusIssues=degradedPhases.map(x=>`PHASE_${x.phase}_${x.status}`);
 const qualityFlags=[];
 if(statusIssues.length) qualityFlags.push(...statusIssues);
 if(selectionComplete===false) qualityFlags.push('PHASE8_WALLET_SELECTION_INCOMPLETE');
 if(ruleTotal>0 && evaluated<ruleTotal) qualityFlags.push('PHASE9_RULE_EVALUATION_INCOMPLETE');
 if(excludedDimensions.length) qualityFlags.push('SCORING_DIMENSION_EXCLUDED');
 const assessment=qualityFlags.length?'CONDITIONAL':'GOOD_WITHIN_OBSERVED_SCOPE';
 return {
   model:'DATA_QUALITY_ASSESSMENT_V1',
   assessment,
   numeric_score:null,
   score_policy:'No new 0-100 data-quality score is introduced in Stage 6M; numeric calibration requires an empirically validated model.',
   phase_status_counts:phaseStatusCounts,
   degraded_phases:degradedPhases,
   phase_coverage_semantics:'Phase presence means artifact availability only; it is not equivalent to COMPLETE data coverage.',
   wallet_history:{
     wallets_selected:Number(p8Summary.wallets_selected||selected||0),
     wallets_scanned:Number(p8Summary.wallets_scanned||0),
     complete_histories:Number(p8Summary.complete_histories||0),
     partial_histories:Number(p8Summary.partial_histories||0),
     failed_histories:Number(p8Summary.failed||0),
     selection:{candidate_wallets:candidates,selected_wallets:selected,skipped_wallets:skipped,selection_complete:selectionComplete},
     selection_quality:'Selection completeness is reported separately from history completeness.'
   },
   rule_evaluation:{total:ruleTotal,evaluated,not_evaluated:Math.max(0,ruleTotal-evaluated),status_counts:ruleStatusCounts},
   evidence_quality:evidenceSummary,
   scoring_eligibility:{excluded_dimensions:excludedDimensions,note:'Eligibility is separate from data completeness. An excluded scoring dimension is not automatically a data-quality failure.'},
   current_scoring_support_confidence:{
     level:confidenceMeta.level,
     score:confidenceMeta.score,
     model:'SCORING_SUPPORT_CONFIDENCE_V1',
     basis:['dimension availability','Phase 8 complete history ratio','Phase 9 evaluated rule ratio'],
     note:'This metric describes support for the current scoring output. It is not a standalone data-quality score, probability, or token-quality guarantee.'
   },
   quality_flags:qualityFlags,
   calibration:{status:'NOT_EMPIRICALLY_VALIDATED',numeric_data_quality_model:false},
   not_used_for_scoring:true
 };
}

function buildReport(p,mint,integrity=null){
 const dims=scoreDimensions(p); const usable=dims.filter(d=>d.available);
 const totalWeight=usable.reduce((s,d)=>s+d.weight,0);
 // Phase 11 formula is LOCKED: weighted mean of available dimensions.
 // These intermediate values expose the existing calculation without changing it.
 const weightedSum=usable.reduce((s,d)=>s+d.score*d.weight,0);
 const rawScore=usable.length?weightedSum/totalWeight:null;
 const finalScore=usable.length?Math.round(clamp(rawScore)):null;
 const scoringLedger=dims.map(d=>({
   dimension:d.id, label:d.label, phase:d.source?.match(/^phase(\d+)/)?.[1]?Number(d.source.match(/^phase(\d+)/)[1]):null,
   weight:d.weight, available:d.available, score:d.available?d.score:null,
   weighted_contribution:d.available?round(d.score*d.weight,4):null,
   contribution_status:d.available?'INCLUDED':'EXCLUDED', source:d.source, reason:d.reason, details:d.details||{}
 }));
 const tier=finalScore===null?{tier:null,label:'Tidak tersedia'}:tierFor(finalScore);
 const p8=p[8]?.summary||{},p9=p[9]?.summary||{},p10=p[10]||{}; const phasePresent=Object.values(p).filter(Boolean).length;
 const complete=Number(p8.complete_histories||0),wallets=Number(p8.wallets_scanned||0); const ruleTotal=Number(p9.rules_total||0); const evaluated=Number(p9.triggered||0)+Number(p9.provisional||0)+Number(p9.not_triggered||0);
 // Ronde 15 (P0): gerbang cakupan — batasi klaim klasifikasi, BUKAN angka skor.
 const p9rules=Array.isArray(p[9]?.rules)?p[9].rules:null;
 const insufficientCount=p9rules?p9rules.filter(r=>String(r?.status||'').toUpperCase()==='INSUFFICIENT_DATA').length:(ruleTotal?Math.max(0,ruleTotal-evaluated):null);
 const riskAvailable=dims.find(d=>d.id==='risk_findings')?.available===true;
 const gate=evaluateScoreGate({tier,riskAvailable,insufficientCount,ruleTotal:ruleTotal||(p9rules?p9rules.length:null)},loadScoreGateSection());
 const gatedTier=gate.applied?(TIERS.find(t=>t.tier===gate.classification_after_gate.tier)||tier):tier;
 // Ronde 17 (P1): skor tandingan TANPA adjustment DB — dua sumbu sinyal
 // dibaca terpisah (on-chain murni vs kerumunan DB). Formula skor resmi
 // TIDAK berubah; varian ini dihitung dari pre_db_score per dimensi
 // dengan denominator yang sama persis.
 const rawNoDb=usable.length?usable.reduce((s,d)=>s+(d.details?.pre_db_score ?? d.score)*d.weight,0)/totalWeight:null;
 const scoreNoDb=rawNoDb===null?null:Math.round(clamp(rawNoDb));
 const tierNoDb=scoreNoDb===null?{tier:null,label:'Tidak tersedia'}:tierFor(scoreNoDb);
 const scoreVariants={
  version:'p1-dual-score-v1',
  with_db:{score:finalScore,raw_score:rawScore===null?null:round(rawScore,2),classification:{tier:gatedTier.tier,label:gatedTier.label},note:'Skor resmi (headline): dimensi on-chain + adjustment database_conviction (Opsi B), dengan gerbang cakupan P0.'},
  without_db:{score:scoreNoDb,raw_score:rawNoDb===null?null:round(rawNoDb,2),classification:{tier:tierNoDb.tier,label:tierNoDb.label},note:'Skor tandingan: dimensi on-chain murni sebelum adjustment DB. Gerbang cakupan tidak diterapkan pada varian ini.'},
  db_delta_points:(finalScore!==null&&scoreNoDb!==null)?finalScore-scoreNoDb:null,
  db_delta_raw:(rawScore!==null&&rawNoDb!==null)?round(rawScore-rawNoDb,2):null,
 };
 // Ronde 17 (P1): deklarasi eksplisit fee_utility. Penelusuran ronde 17:
 // Phase 6 MENGHASILKAN skor fee (-10..10, hanya dari komponen
 // terverifikasi), tetapi Phase 11 hanya memasukkannya bila
 // project_utility_verified (definisi sempit: utilitas protokol saja).
 // Untuk token kelas pump.fun syarat itu praktis tidak terpenuhi
 // (23/23 scan batch 1 + Baton) — dimensi selama ini hilang diam-diam
 // dari denominator. Kini dinyatakan terbuka.
 // Ronde 19 (keputusan Rin 2026-10-21): model M2 DIAKTIFKAN — eligibility
 // diperluas ke semua bukti penggunaan terverifikasi + peta netral
 // 50 + 5×skor (lihat scoreDimensions). Status di bawah melaporkan
 // model yang dipakai; token tanpa bukti tetap NOT_USED (deklarasi).
 const feeDim=dims.find(d=>d.id==='fee_utility');
 const feeAssessment=p[6]?.fee_economic_assessment||null;
 const feeUtilityStatus={
  version:'p1-fee-utility-status-v2',
  used_in_score:feeDim?.available===true,
  status:feeDim?.available===true?'USED':'NOT_USED',
  model:feeDim?.details?.model ?? null,
  verified_uses:feeDim?.details?.verified_uses ?? null,
  classification:feeAssessment?.classification||null,
  source_score:feeDim?.details?.source_score ?? null,
  source_confidence:feeDim?.details?.source_confidence ?? null,
  project_utility_verified:feeDim?.details?.project_utility_verified ?? null,
  project_utility_evidence_status:feeDim?.details?.project_utility_evidence_status ?? null,
  eligibility_status:feeDim?.details?.eligibility_status ?? null,
  buyback_burn_verified:feeAssessment?.buyback_burn_verified ?? null,
  creator_extraction_verified:feeAssessment?.creator_extraction_verified ?? null,
  holder_benefit_verified:feeAssessment?.holder_benefit_verified ?? null,
  note:feeDim?.available===true
    ? 'Dimensi fee_utility DIPAKAI dengan model M2 (keputusan Rin 2026-10-21): peta netral 50 + 5×skor Phase 6, aktif karena ada bukti penggunaan fee terverifikasi. Pemetaan baseline — belum dikalibrasi historis.'
    : 'Dimensi fee_utility dinyatakan TIDAK DIPAKAI untuk token ini (tidak ada bukti penggunaan fee terverifikasi). Skor sumber Phase 6 dan bukti terverifikasi tetap dicatat di sini sebagai bukti teramati — bukan skor. Bobot dimensi ini tidak masuk denominator.',
 };
 const phaseCoverage=round(phasePresent/10*100); const historyCoverage=wallets?round(complete/wallets*100):null; const ruleCoverage=ruleTotal?round(evaluated/ruleTotal*100):null;
 const dimensionCoverage=round(usable.reduce((s,d)=>s+d.weight,0)/dims.reduce((s,d)=>s+d.weight,0)*100);
 const coverage=round((phaseCoverage*0.45)+( (historyCoverage??0)*0.35)+((ruleCoverage??0)*0.20));
 const confidenceScore=round(dimensionCoverage*0.5+(historyCoverage??0)*0.25+(ruleCoverage??0)*0.25);
 const confidence=confidenceScore>=80?'HIGH':confidenceScore>=55?'MEDIUM':'LOW';
 const dataQuality=buildDataQualityAssessment(p,dims,{level:confidence,score:confidenceScore});
 const limitations=[...(integrity?.warnings||[])]; if(phasePresent<10)limitations.push(`Hanya ${phasePresent}/10 phase tersedia.`); if(historyCoverage!==null&&historyCoverage<100)limitations.push(`Histori wallet lengkap ${complete}/${wallets}; sisanya parsial atau tidak lengkap.`); if(ruleCoverage!==null&&ruleCoverage<100)limitations.push(`Rule Phase 9 yang dapat dievaluasi ${evaluated}/${ruleTotal}; sisanya tidak dihitung sebagai sinyal positif maupun negatif.`); limitations.push('Skor memakai baseline heuristik awal dan belum divalidasi dengan dataset historis berlabel.'); limitations.push('Coverage dan Confidence menjelaskan kelengkapan/dukungan data, bukan probabilitas atau jaminan kualitas token.'); if(gate.applied)limitations.push(`Gerbang cakupan P0 diterapkan (${gate.reasons.join(', ')}): klasifikasi dibatasi maksimal tier ${gate.tier_cap} dan skor berstatus PROVISIONAL. Skor mentah ${finalScore}/100 (tier mentah ${tier.label}) tidak diubah.`); if(feeUtilityStatus.status==='NOT_USED')limitations.push(`Dimensi fee_utility TIDAK DIPAKAI untuk token ini (klasifikasi Phase 6: ${feeUtilityStatus.classification||'tidak tersedia'}; syarat project_utility_verified tidak terpenuhi). Lihat summary.fee_utility_status — bukti fee tetap tercatat, hanya tidak diskor.`); const ctr02Rule=p9rules?p9rules.find(r=>r?.rule_id==='CTR-02'):null; if(ctr02Rule&&String(ctr02Rule.status||'').toUpperCase()==='NOT_TRIGGERED')limitations.push('CTR-02 padam ≠ aman: tidak adanya (atau di bawah ambang 10) sekuens funding->trade bukan jaminan token aman. Pelajaran LouLou — CTR-02 NOT_TRIGGERED tetapi outcome formal 7 hari buruk (HIDUP, rel_sol -86,8%).'); const tokenAge=p[9]?.scope?.token_age; if(tokenAge&&tokenAge.regime==='early')limitations.push(`Regime dini (ronde 26): umur teramati token ${tokenAge.age_minutes} menit saat scan (sumber: ${tokenAge.birth_source||'tidak tercatat'} — proksi peluncuran dari event Phase 8 tertua); threshold rezim dini belum ditetapkan dari kohort, sehingga threshold matang dipakai sementara dan interpretasi SPR-02/CTR-02 untuk token dini ini bersifat sementara.`);
 return {phase:11,phase_name:'CLASSIFICATION_CONFIDENCE_FINAL_REPORT',version:VERSION,status:(integrity?.warnings?.length||phasePresent<10)?'PARTIAL':'COMPLETE',generated_at:new Date().toISOString(),run_id:integrity?.run_id||process.env.SCAN_RUN_ID||null,provenance:{run_id:integrity?.run_id||process.env.SCAN_RUN_ID||null,mint,phases_checked:integrity?.phases_checked||[],validation_status:integrity?.valid===false?'INVALID':integrity?.warnings?.length?'WARNING':'VALID'},input:{mint,source:'phase1-result.json ... phase10-result.json'},data_integrity:integrity||{valid:true,errors:[],warnings:[]},scoring_method:{version:'phase11-baseline-v1',score_range:[1,100],method:'Weighted mean of available dimensions; weights are renormalized over available dimensions. Missing dimensions are excluded, not assigned zero.',weights:Object.fromEntries(dims.map(d=>[d.id,d.weight])),tiers:TIERS,calibration_status:'BASELINE_NOT_HISTORICALLY_VALIDATED',important_note:'Final Quality Score is a baseline indicator based on mapped upstream signals, not a probability, investment recommendation, or guarantee.'},summary:{mint,final_quality_score:finalScore,classification:gatedTier,score_gate:gate,score_variants:scoreVariants,fee_utility_status:feeUtilityStatus,confidence:{level:confidence,score:confidenceScore,model:'SCORING_SUPPORT_CONFIDENCE_V1',meaning:'Dukungan terhadap scoring saat ini; bukan data-quality score atau probabilitas.'},coverage:{score:coverage,phase_presence_pct:phaseCoverage,phase8_history_complete_pct:historyCoverage,phase9_rule_evaluated_pct:ruleCoverage,dimension_coverage_pct:dimensionCoverage},data_quality:dataQuality,dimensions_available:usable.length,dimensions_total:dims.length,phases_present:phasePresent,phases_expected:10,calibration_status:'BASELINE_NOT_HISTORICALLY_VALIDATED'},
 score_explainability:{
   formula:'raw_score = weighted_sum / available_weight; final_score = round(raw_score)',
   weights:Object.fromEntries(dims.map(d=>[d.id,d.weight])),
   weighted_sum:usable.length?round(weightedSum,4):null,
   available_weight:usable.length?totalWeight:0,
   raw_score:rawScore===null?null:round(rawScore,6),
   final_score:finalScore,
   rounding:'nearest integer (Math.round)',
   denominator_policy:'Only available dimensions are included; unavailable dimensions are excluded, not assigned zero.',
   ledger:scoringLedger
 },
 score_breakdown:dims,phase_status:Object.fromEntries(Array.from({length:10},(_,i)=>{const n=i+1;return [n,p[n]?.status||'MISSING']})),evidence_summary:{phase10_findings_total:p10.summary?.rules_total??null,phase10_findings_scored:p10.summary?.findings_scored??null,phase10_wallets_total:p10.summary?.wallets_total??null,phase10_evidence_groups:(p10.evidence_groups||[]).length,phase10_top_risk_groups:(p10.evidence_groups||[]).filter(hasNumericRisk).sort((a,b)=>Number(b.risk.score)-Number(a.risk.score)).slice(0,10).map(g=>({category:g.category,wallet:g.wallet,member_rule_ids:g.member_rule_ids,risk_score:g.risk.score,evidence_strength:g.evidence_strength?.score,source_refs:g.source_refs||[],evidence_identities:g.evidence_identities||[]}))},risk_assessment:{risk_score_source:'Phase10',interpretation:'Risk score tetap menggunakan makna Phase 10; tidak disamakan dengan Final Quality Score.',groups_scored:(p10.evidence_groups||[]).filter(hasNumericRisk).length},limitations,final_report:{headline:finalScore===null?'Skor tidak tersedia — data indikator tidak memadai':(gate.applied?`PROVISIONAL — ${gatedTier.label} — ${finalScore}/100`:`${gatedTier.label} — ${finalScore}/100`),interpretation:'Skor akhir baseline yang merangkum indikator yang dapat dipetakan dari hasil Phase 1–10.',caveats:limitations}};
}
function showMain(r){const s=r.summary,t=s.classification; console.log('\n╔══════════════════════════════════════════════════╗\n║       SOLANA TOKEN INTELLIGENCE — PHASE 11       ║\n║          CLASSIFICATION + FINAL REPORT           ║\n╚══════════════════════════════════════════════════╝');console.log(`\nTOKEN       : ${r.input.mint}\nFINAL SCORE : ${s.final_quality_score??'N/A'} / 100\nCLASS       : ${t.tier===null?'TIDAK TERSEDIA':`TIER ${t.tier} — ${t.label.toUpperCase()}`}\nCONFIDENCE  : ${s.confidence.level} (${s.confidence.score}/100)\nCOVERAGE    : ${s.coverage.score}%\nCALIBRATION : BASELINE (BELUM TERVALIDASI HISTORIS)`);if(s.score_gate?.applied)console.log(`STATUS      : PROVISIONAL — tier dibatasi maks ${s.score_gate.tier_cap} (gerbang cakupan: ${s.score_gate.reasons.join(', ')})`);console.log(`RULE EVAL   : ${s.coverage.phase9_rule_evaluated_pct??'N/A'}% rule Phase 9 terevaluasi`);if(s.score_variants)console.log(`SKOR TANPA DB: ${s.score_variants.without_db.score??'N/A'} / 100 (${s.score_variants.without_db.classification.label}) — delta DB ${s.score_variants.db_delta_points===null?'N/A':(s.score_variants.db_delta_points>=0?'+':'')+s.score_variants.db_delta_points} poin`);if(s.fee_utility_status&&s.fee_utility_status.status==='NOT_USED')console.log(`FEE UTILITY  : TIDAK DIPAKAI — klasifikasi ${s.fee_utility_status.classification||'UNKNOWN'}, skor sumber ${s.fee_utility_status.source_score??'N/A'} (bukti, bukan skor)`);if(s.fee_utility_status&&s.fee_utility_status.status==='USED')console.log(`FEE UTILITY  : DIPAKAI (model M2) — skor sumber ${s.fee_utility_status.source_score??'N/A'} -> dimensi ${r.score_breakdown.find(d=>d.id==='fee_utility')?.score??'N/A'}`);console.log('\nDetail lengkap: lihat file phase11-result.json pada folder Output token ini.');}
async function main(){const args=process.argv.slice(2);let mint=null;const mi=args.indexOf('--mint');if(mi>=0)mint=args[mi+1];const target=locateMint(mint);const phases=loadInputs(target.dir);const scanContext=loadScanContext(target.dir);const integrity=validatePhaseInputs(phases,target.mint,scanContext);if(!integrity.valid)throw Error(`INPUT_INTEGRITY_FAILED\n${integrity.errors.join('\n')}`);const report=buildReport(phases,target.mint,integrity);const out=path.join(target.dir,'phase11-result.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`Phase 11 result disimpan: ${out}`);if(args.includes('--json')){console.log(JSON.stringify(report,null,2));return;}showMain(report);}
if(require.main===module) main().catch(e=>{console.error(`ERROR: ${e.message}`);process.exitCode=1;});
module.exports={buildReport,scoreDimensions,tierFor,validatePhaseInputs,phaseMint,phaseTimestamp,hasNumericRisk,TIERS,evaluateScoreGate,resolveScoreGateConfig,loadScoreGateSection,SCORE_GATE_DEFAULTS};
