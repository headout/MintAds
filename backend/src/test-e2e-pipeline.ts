/**
 * E2E pipeline test: Script Engine → Audio Engine + Video Engine (parallel fan-out)
 *
 * Uses existing facts.json from disk (skips Headout API).
 * Mirrors the orchestrator's Step 1 + Step 2 fan-out exactly.
 *
 * Run: cd backend && npx ts-node --transpile-only src/test-e2e-pipeline.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import fs from 'fs/promises';
import { db } from './db';
import { generateScript, generateAdId } from './script-engine';
import { fetchExperienceFacts } from './services/headout-client';
import { generateAllVoSegments } from './services/elevenlabs-client';
import { generateVideoClips } from './services/fal-client';
import type { UserInput, AngleDef, HookDef } from './types';

const userInput: UserInput = {
  experience_id: '7148',
  persona: 'solo',
  journey_type: 'pre_trip',
  brand: 'headout',
  angle: 'A3',
  hook: 'problem',
  video_format: '9:16',
};

const angleDef: AngleDef = {
  id: 'A3',
  name: 'Skip-the-Line',
  description: 'Queues = wasted holiday. Dramatize 3-hour line, rescue with skip-the-line.',
  example_line: 'They waited 3 hours. We walked straight in.',
};

const hookDef: HookDef = {
  id: 'problem',
  name: 'Problem',
  template: 'Going to {city} and dreading the {POI} queue?',
  description: 'Problem-aware audience; dramatize the pain',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sep(label: string) {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`  ${label}`);
  console.log('─'.repeat(64));
}

function elapsed(ms: number): string {
  return ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const wallStart = Date.now();

  // ── Step 0: Reserve adId + create DB run row ──────────────────────────────
  sep('STEP 0 — Reserve adId + create DB run row');

  // generateAdId needs facts (for city), so use a placeholder adId for the
  // run insert, then update it once facts arrive. Or: use experience_id directly.
  // Simpler: pre-compute a deterministic adId from known inputs.
  const placeholderAdId = `HDO_META_Rome_A3_problem_UGC_EN_v01`;
  const runRes = await db.query(
    `INSERT INTO runs
       (ad_id, experience_id, persona, journey_type, brand, angle_id, hook_id, video_format, status, current_stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending','ingesting')
     RETURNING id`,
    [placeholderAdId, userInput.experience_id, userInput.persona, userInput.journey_type,
     userInput.brand, userInput.angle, userInput.hook, userInput.video_format],
  );
  const runId: number = runRes.rows[0].id;
  console.log(`  run_id : ${runId}`);
  console.log(`  ad_id  : ${placeholderAdId}`);

  // ── Step 1: Fetch facts from Headout API ───────────────────────────────────
  sep('STEP 1 — Content Ingestion (Headout API → facts.json)');
  console.log('  Fetching Colosseum (7148)…');
  const tFacts = Date.now();
  const facts = await fetchExperienceFacts(userInput.experience_id, runId, placeholderAdId);
  console.log(`  Done in ${elapsed(Date.now() - tFacts)}`);
  console.log(`  title  : ${facts.title}`);
  console.log(`  city   : ${facts.city}`);
  console.log(`  price  : ${facts.price.display}`);
  console.log(`  photos : ${facts.photos.length}`);

  const adId = generateAdId(facts, userInput);
  console.log(`\n  adId   : ${adId}`);

  // ── Step 2: Script Engine ──────────────────────────────────────────────────
  sep('STEP 2 — Script Engine (Claude → script.json + validation)');
  console.log('  Calling Claude… (~5–15s)');
  const tScript = Date.now();
  const { script, claim_report } = await generateScript(facts, userInput, angleDef, hookDef, runId, adId);
  console.log(`  Done in ${elapsed(Date.now() - tScript)}`);

  console.log(`\n  ad_id          : ${script.ad_id}`);
  console.log(`  total video dur: ${script.video_script.total_duration_sec}s`);
  console.log(`  total VO target: ${script.audio_script.total_duration_target_sec}s`);

  const allScenes = script.video_script.scenes;
  const contentScenes = allScenes.filter(s => s.beat !== 'cta');
  const nonLipSyncScenes = contentScenes.filter(s => !s.lip_sync);
  const lipSyncScenes = contentScenes.filter(s => s.lip_sync);

  console.log(`\n  Scenes (${allScenes.length} total, ${contentScenes.length} content + 1 cta):`);
  for (const sc of allScenes) {
    const lipTag = sc.lip_sync ? ' [lip-sync]' : '';
    const overlayTag = sc.text_overlay ? ` overlay:"${sc.text_overlay}"` : '';
    console.log(
      `    [${sc.beat.padEnd(7)}] scene ${sc.scene_id}  ${sc.shot_type.padEnd(18)} ${sc.duration_sec}s${lipTag}${overlayTag}`,
    );
  }

  console.log(`\n  VO segments (${script.audio_script.vo_segments.length}):`);
  for (const seg of script.audio_script.vo_segments) {
    const pause = seg.pause_after_sec ? ` +${seg.pause_after_sec}s break` : '';
    console.log(`    [scene ${seg.scene_id}] ${seg.beat.padEnd(7)} ${seg.target_duration_sec}s target${pause}`);
    console.log(`               "${seg.vo_text.slice(0, 80)}${seg.vo_text.length > 80 ? '…' : ''}"`);
  }

  console.log(`\n  Claim report: ${claim_report.verified_claims}/${claim_report.total_claims} verified`);
  console.log(`  Creator: ${script.video_script.global_style.creator_description.slice(0, 80)}…`);

  // Fan-out plan
  console.log(`\n  Fan-out plan:`);
  console.log(`    Step 1 (parallel): generateAllVoSegments + ${nonLipSyncScenes.length} non-lip-sync clip(s)`);
  if (lipSyncScenes.length > 0) {
    console.log(`    Step 2 (after Step 1): ${lipSyncScenes.length} lip-sync clip(s) using VO as @Audio1`);
  } else {
    console.log(`    Step 2: no lip-sync scenes`);
  }

  // ── Step 3: Audio + non-lip-sync video in PARALLEL ─────────────────────────
  sep(`STEP 3 — Step 1 fan-out: Audio + ${nonLipSyncScenes.length} non-lip-sync clip(s) in parallel`);
  await db.query(`UPDATE runs SET status='generating', current_stage='audio_gen + video_gen' WHERE id=$1`, [runId]);

  const tStep1 = Date.now();
  const [voSegments, nonLipSyncClips] = await Promise.all([
    generateAllVoSegments(script, adId, runId),
    nonLipSyncScenes.length > 0
      ? generateVideoClips(nonLipSyncScenes, script, facts, runId, adId)
      : Promise.resolve([]),
  ]);
  console.log(`\n  Step 1 wall time: ${elapsed(Date.now() - tStep1)}`);

  console.log(`\n  VO segments generated:`);
  for (const vo of voSegments) {
    const seg = script.audio_script.vo_segments.find(s => s.scene_id === vo.scene_id)!;
    const drift = Math.abs(vo.duration_sec - seg.target_duration_sec);
    const driftNote = drift > 3 ? `⚠ ${drift.toFixed(1)}s drift` : `✓`;
    console.log(`    scene ${vo.scene_id}: ${vo.duration_sec.toFixed(1)}s actual / ${seg.target_duration_sec}s target  ${driftNote}`);
    console.log(`      → ${path.basename(vo.file_path)}`);
  }

  if (nonLipSyncClips.length > 0) {
    console.log(`\n  Non-lip-sync clips generated:`);
    for (const clip of nonLipSyncClips) {
      console.log(`    scene ${clip.scene_id} (${clip.beat}, ${clip.shot_type}): ${clip.duration_sec}s`);
      console.log(`      → ${path.basename(clip.file_path)}`);
    }
  }

  // ── Step 4: Lip-sync video clips (need VO from Step 1) ────────────────────
  let lipSyncClips: typeof nonLipSyncClips = [];
  if (lipSyncScenes.length > 0) {
    sep(`STEP 4 — Step 2: ${lipSyncScenes.length} lip-sync clip(s) — VO segments now available`);
    const tStep2 = Date.now();
    lipSyncClips = await generateVideoClips(lipSyncScenes, script, facts, runId, adId, voSegments);
    console.log(`  Step 2 wall time: ${elapsed(Date.now() - tStep2)}`);

    console.log(`\n  Lip-sync clips generated:`);
    for (const clip of lipSyncClips) {
      const vo = voSegments.find(v => v.scene_id === clip.scene_id);
      const audioNote = vo ? `  audio: ${path.basename(vo.file_path)}` : '';
      console.log(`    scene ${clip.scene_id} (${clip.beat}, ${clip.shot_type}): ${clip.duration_sec}s${audioNote}`);
      console.log(`      → ${path.basename(clip.file_path)}`);
    }
  } else {
    sep('STEP 4 — No lip-sync scenes (skipped)');
  }

  // ── Step 5: Summary ───────────────────────────────────────────────────────
  sep('STEP 5 — Summary');

  const allClips = [...nonLipSyncClips, ...lipSyncClips].sort((a, b) => a.scene_id - b.scene_id);
  const totalWall = Date.now() - wallStart;

  await db.query(`UPDATE runs SET status='assembling', current_stage='assembly' WHERE id=$1`, [runId]);

  console.log(`  Total wall time : ${elapsed(totalWall)}`);
  console.log(`  Clips produced  : ${allClips.length} / ${contentScenes.length}`);
  console.log(`  VO segments     : ${voSegments.length} / ${script.audio_script.vo_segments.length}`);

  console.log('\n  All clips (in scene order):');
  for (const clip of allClips) {
    const vo = voSegments.find(v => v.scene_id === clip.scene_id);
    const lipNote = clip.shot_type === 'ugc_creator' && vo ? '  ← lip-synced to VO' : '';
    console.log(`    scene ${clip.scene_id} [${clip.beat.padEnd(7)}] ${clip.shot_type.padEnd(18)} ${clip.duration_sec}s${lipNote}`);
  }

  // Stage logs + cost
  const logs = await db.query(
    `SELECT stage, status, duration_ms, cost_usd FROM stage_logs WHERE run_id=$1 ORDER BY id`,
    [runId],
  );
  let totalCost = 0;
  console.log('\n  Stage logs:');
  for (const row of logs.rows) {
    const cost = Number(row.cost_usd);
    totalCost += cost;
    console.log(
      `    ${row.stage.padEnd(28)} ${row.status.padEnd(10)} ${String(row.duration_ms ?? '?').padStart(6)}ms  $${cost.toFixed(5)}`,
    );
  }
  console.log(`\n  Total cost tracked in stage logs: $${totalCost.toFixed(4)}`);

  const runRow = await db.query('SELECT total_cost_usd FROM runs WHERE id=$1', [runId]);
  console.log(`  runs.total_cost_usd             : $${Number(runRow.rows[0].total_cost_usd).toFixed(4)}`);

  console.log(`\n  Artifacts at: data/runs/${adId}/`);
  const files = await fs.readdir(path.resolve(__dirname, `../../data/runs/${adId}`), { recursive: true });
  for (const f of files.filter((f): f is string => typeof f === 'string').sort()) {
    console.log(`    ${f}`);
  }

  sep('DONE — ready for Remotion assembly (Chunk 5)');
  console.log(`  run_id : ${runId}`);
  console.log(`  adId   : ${adId}`);
}

main()
  .catch(err => {
    console.error('\n✗ PIPELINE FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(() => {
    db.query('SELECT 1').then(() => process.exit(0));
  });
