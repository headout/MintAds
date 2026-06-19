/**
 * Manual integration test for Chunk 4: Audio Engine
 * Uses the existing script.json from the script engine test run.
 * Run: cd backend && npx ts-node --transpile-only src/test-audio-engine.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import fs from 'fs/promises';
import { db } from './db';
import { generateVoSegment, generateAllVoSegments } from './services/elevenlabs-client';
import type { ScriptJson } from './types';

// Reuse the script from the existing run written by test-script-engine.ts
const EXISTING_AD_ID = 'HDO_META_Rome_A3_problem_UGC_EN_v01';
const SCRIPT_PATH = path.resolve(
  __dirname,
  `../../data/runs/${EXISTING_AD_ID}/script.json`,
);

// Ad ID for the audio test run (unique so it doesn't collide with the script run)
const TEST_AD_ID = `AUDIO_TEST_${Date.now()}`;

function sep(label: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('─'.repeat(60));
}

async function main() {
  sep('STEP 0 — Load existing script.json');
  let script: ScriptJson;
  try {
    const raw = await fs.readFile(SCRIPT_PATH, 'utf-8');
    script = JSON.parse(raw);
    console.log(`Loaded from: ${SCRIPT_PATH}`);
  } catch {
    console.error(`No script found at ${SCRIPT_PATH}`);
    console.error('Run test-script-engine.ts first to generate a script.');
    process.exit(1);
  }

  console.log('\nScript summary:');
  console.log('  ad_id         :', script.ad_id);
  console.log('  vo_segments   :', script.audio_script.vo_segments.length);
  console.log('  total VO target:', script.audio_script.total_duration_target_sec, 's');
  console.log('  tone          :', script.audio_script.tone);
  console.log('  delivery      :', script.audio_script.delivery_style);

  console.log('\nVO segments:');
  for (const seg of script.audio_script.vo_segments) {
    const breakTag = seg.pause_after_sec ? ` + ${seg.pause_after_sec}s break` : '';
    console.log(
      `  [scene ${seg.scene_id}] ${seg.beat.padEnd(7)}  ${seg.target_duration_sec}s target${breakTag}`,
    );
    console.log(`    "${seg.vo_text}"`);
  }

  sep('STEP 1 — Create DB run row for audio test');

  const runRes = await db.query(
    `INSERT INTO runs
       (ad_id, experience_id, persona, journey_type, brand, angle_id, hook_id, video_format, status, current_stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'generating','audio_gen')
     RETURNING id`,
    [
      TEST_AD_ID,
      'colosseum-rome-test',
      'solo',
      'pre_trip',
      'headout',
      'A3',
      'problem',
      '9:16',
    ],
  );
  const runId: number = runRes.rows[0].id;
  console.log(`run_id : ${runId}`);
  console.log(`ad_id  : ${TEST_AD_ID}`);

  // ── Test 1: Single segment (sanity check, minimal spend) ───────────────────
  sep('STEP 2 — Single segment test (scene 1)');

  const firstSeg = script.audio_script.vo_segments[0];
  console.log(`Generating VO for scene ${firstSeg.scene_id} (${firstSeg.beat})…`);
  console.log(`Text: "${firstSeg.vo_text}"`);

  const t1 = Date.now();
  const singleResult = await generateVoSegment(firstSeg, TEST_AD_ID, runId);
  const elapsed1 = Date.now() - t1;

  console.log(`\nResult:`);
  console.log(`  file_path    : ${singleResult.file_path}`);
  console.log(`  duration_sec : ${singleResult.duration_sec.toFixed(2)}s`);
  console.log(`  characters   : ${singleResult.characters}`);
  console.log(`  cost         : $${((singleResult.characters / 1000) * 0.03).toFixed(5)}`);
  console.log(`  wall time    : ${elapsed1}ms`);

  // Verify file exists + non-zero
  const stats = await fs.stat(singleResult.file_path);
  console.log(`  file_size    : ${stats.size} bytes`);
  if (stats.size === 0) throw new Error('VO file is 0 bytes!');
  console.log(`  ✓ file written and non-empty`);

  // Duration sanity
  const drift = Math.abs(singleResult.duration_sec - firstSeg.target_duration_sec);
  console.log(`  duration drift: ${drift.toFixed(1)}s (target was ${firstSeg.target_duration_sec}s)`);
  if (drift > 3) {
    console.warn(`  ⚠ WARN: drift exceeds 3s threshold`);
  } else {
    console.log(`  ✓ within ±3s threshold`);
  }

  // ── Test 2: All segments in parallel ──────────────────────────────────────
  sep('STEP 3 — All VO segments in parallel');
  console.log(`Generating all ${script.audio_script.vo_segments.length} segments…`);

  const t2 = Date.now();
  const allResults = await generateAllVoSegments(script, TEST_AD_ID, runId);
  const elapsed2 = Date.now() - t2;

  console.log(`\nAll segments complete in ${elapsed2}ms wall time:`);
  for (const r of allResults) {
    const seg = script.audio_script.vo_segments.find((s) => s.scene_id === r.scene_id)!;
    const d = Math.abs(r.duration_sec - seg.target_duration_sec);
    const driftNote = d > 3 ? `  ⚠ ${d.toFixed(1)}s drift` : `  ✓`;
    console.log(
      `  [scene ${r.scene_id}]  ${r.duration_sec.toFixed(2)}s actual / ${seg.target_duration_sec}s target  ${driftNote}`,
    );
    console.log(`           → ${r.file_path}`);
  }

  const totalChars = allResults.reduce((s, r) => s + r.characters, 0);
  const totalCost = (totalChars / 1000) * 0.03;
  console.log(`\nTotal characters: ${totalChars}`);
  console.log(`Total cost: $${totalCost.toFixed(5)}`);
  console.log(`Files in data/runs/${TEST_AD_ID}/`);

  // ── Step 4: Check stage_logs ───────────────────────────────────────────────
  sep('STEP 4 — Stage logs for this run');
  const logs = await db.query(
    `SELECT stage, status, duration_ms, cost_usd, result
     FROM stage_logs WHERE run_id = $1 ORDER BY id`,
    [runId],
  );
  for (const row of logs.rows) {
    const res = row.result as Record<string, unknown>;
    const driftNote = res?.duration_drift_sec != null
      ? `  drift=${res.duration_drift_sec}s`
      : '';
    console.log(
      `  ${row.stage.padEnd(24)}  ${row.status.padEnd(10)}  ${String(row.duration_ms ?? '?').padStart(5)}ms` +
        `  $${Number(row.cost_usd).toFixed(5)}${driftNote}`,
    );
  }

  sep('DONE ✓');
  console.log(`run_id     : ${runId}`);
  console.log(`ad_id      : ${TEST_AD_ID}`);
  console.log(`output dir : data/runs/${TEST_AD_ID}/`);
  console.log('Audio engine test passed.');
}

main()
  .catch((err) => {
    console.error('\n✗ TEST FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(() => {
    db.query('SELECT 1').then(() => process.exit(0));
  });
