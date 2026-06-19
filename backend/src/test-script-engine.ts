/**
 * Manual integration test for Chunk 2: Script Engine
 * Run: cd backend && npx ts-node --transpile-only src/test-script-engine.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { db } from './db';
import { fetchExperienceFacts } from './services/headout-client';
import { generateScript, generateAdId } from './script-engine';
import type { UserInput, AngleDef, HookDef } from './types';

// ── Inputs ──────────────────────────────────────────────────────────────────

const EXPERIENCE_ID = '7148'; // Colosseum Rome — tracer bullet

const userInput: UserInput = {
  experience_id: EXPERIENCE_ID,
  persona: 'solo',
  journey_type: 'pre_trip',
  brand: 'headout',
  angle: 'A3',
  hook: 'problem',
  video_format: '9:16',
};

// From seed.sql
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
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('─'.repeat(60));
}

function json(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  sep('STEP 0 — Test inputs');
  console.log('Experience ID :', EXPERIENCE_ID);
  console.log('Persona       :', userInput.persona);
  console.log('Journey type  :', userInput.journey_type);
  console.log('Brand         :', userInput.brand);
  console.log('Angle         :', `${angleDef.id} — ${angleDef.name}`);
  console.log('Hook          :', `${hookDef.id} — ${hookDef.template}`);
  console.log('Format        :', userInput.video_format);

  // ── Step 1: Insert a test run row ──────────────────────────────────────────
  sep('STEP 1 — Create DB run row');

  // Pre-compute adId (city=Rome is known for 7148; generateAdId confirms below)
  const prelimAdId = 'HDO_META_Rome_A3_problem_UGC_EN_v01';

  const runRes = await db.query(
    `INSERT INTO runs
       (ad_id, experience_id, persona, journey_type, brand, angle_id, hook_id, video_format, status, current_stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending','ingesting')
     RETURNING id`,
    [
      prelimAdId,
      EXPERIENCE_ID,
      userInput.persona,
      userInput.journey_type,
      userInput.brand,
      userInput.angle,
      userInput.hook,
      userInput.video_format,
    ],
  );
  const runId: number = runRes.rows[0].id;
  console.log('run_id  :', runId);
  console.log('ad_id   :', prelimAdId);

  // ── Step 2: Fetch facts from Headout API ───────────────────────────────────
  sep('STEP 2 — Fetch facts from Headout API (experience 7148)');
  console.log('Calling Headout API…');
  const t0 = Date.now();
  const facts = await fetchExperienceFacts(EXPERIENCE_ID, runId, prelimAdId);
  console.log(`Done in ${Date.now() - t0}ms`);
  console.log('\nFacts summary:');
  console.log('  title         :', facts.title);
  console.log('  city          :', facts.city);
  console.log('  price         :', facts.price.display);
  console.log('  rating        :', facts.rating);
  console.log('  review_count  :', facts.review_count);
  console.log('  photos        :', facts.photos.length);
  console.log('  highlights    :', facts.highlights.length);
  console.log('  reviews       :', facts.top_reviews.length);
  console.log('  free cancel   :', facts.has_free_cancellation);
  console.log('  skip-the-line :', facts.has_skip_the_line);

  // Confirm adId matches what generateAdId produces
  const confirmedAdId = generateAdId(facts, userInput);
  console.log('\ngenerated adId :', confirmedAdId);
  if (confirmedAdId !== prelimAdId) {
    console.warn('⚠  adId mismatch — using confirmed adId for generateScript');
  }

  // ── Step 3: Call generateScript ────────────────────────────────────────────
  sep('STEP 3 — generateScript (Claude call + validation)');
  console.log('Sending to Claude… (this takes ~5–15s)');
  const ts = Date.now();

  const result = await generateScript(facts, userInput, angleDef, hookDef, runId, confirmedAdId);

  console.log(`Done in ${Date.now() - ts}ms`);

  // ── Step 4: Print script ───────────────────────────────────────────────────
  sep('STEP 4 — Generated script.json');

  const { script, claim_report } = result;
  console.log('ad_id           :', script.ad_id);
  console.log('total video dur :', script.video_script.total_duration_sec, 's');
  console.log('total VO target :', script.audio_script.total_duration_target_sec, 's');
  console.log('\nScenes:');
  for (const sc of script.video_script.scenes) {
    console.log(
      `  [${sc.beat.padEnd(7)}] scene ${sc.scene_id}  ${sc.duration_sec}s` +
        (sc.text_overlay ? `  overlay: "${sc.text_overlay}"` : ''),
    );
    console.log(`           visual: ${sc.visual_direction.slice(0, 80)}…`);
  }
  console.log('\nVO segments:');
  for (const seg of script.audio_script.vo_segments) {
    console.log(
      `  [${seg.beat.padEnd(7)}] scene ${seg.scene_id}  ${seg.target_duration_sec}s  "${seg.vo_text.slice(0, 70)}…"`,
    );
  }
  console.log('\nEnd card:');
  console.log('  price   :', script.end_card.price_display);
  console.log('  rating  :', script.end_card.rating_display);
  console.log('  reviews :', script.end_card.review_count_display);
  console.log('  cta     :', script.end_card.cta_text);

  const gs = script.video_script.global_style;
  console.log('\nglobal_style:');
  console.log('  creator :', gs.creator_description);
  console.log('  aesthetic:', gs.aesthetic);
  console.log('  bg_music_vol:', gs.background_music_volume);

  console.log('\nclaim_sources:');
  for (const [claim, source] of Object.entries(script.claim_sources)) {
    console.log(`  "${claim}"  →  ${source}`);
  }

  // ── Step 5: Print claim report ─────────────────────────────────────────────
  sep('STEP 5 — Claim report');
  console.log(`total    : ${claim_report.total_claims}`);
  console.log(`verified : ${claim_report.verified_claims}`);
  console.log(`unverified: ${claim_report.unverified_claims}`);
  console.log('\nClaims:');
  for (const c of claim_report.claims) {
    const icon = c.verified ? '✓' : '✗';
    console.log(`  ${icon} "${c.claim_text}"  source_field: ${c.source_field}  source_value: ${c.source_value}`);
    if (c.appears_in.length) console.log(`      appears in: ${c.appears_in.join(', ')}`);
  }

  // ── Step 6: Check stage_logs ───────────────────────────────────────────────
  sep('STEP 6 — Stage logs for this run');
  const logs = await db.query(
    `SELECT stage, status, duration_ms, cost_usd, result
     FROM stage_logs WHERE run_id = $1 ORDER BY id`,
    [runId],
  );
  for (const row of logs.rows) {
    const result = row.result as Record<string, unknown>;
    const tokens = result?.input_tokens
      ? `in=${result.input_tokens} out=${result.output_tokens}`
      : '';
    const violations = result?.violations
      ? ` violations=${(result.violations as string[]).length}`
      : '';
    console.log(
      `  ${row.stage.padEnd(22)}  ${row.status.padEnd(10)}  ${String(row.duration_ms).padStart(5)}ms` +
        `  $${Number(row.cost_usd).toFixed(5)}  ${tokens}${violations}`,
    );
  }

  sep('DONE');
  console.log('run_id :', runId);
  console.log('adId   :', confirmedAdId);
  console.log('Files written to: data/runs/' + confirmedAdId + '/');
}

main()
  .catch(err => {
    console.error('\n✗ TEST FAILED:', err.message);
    process.exit(1);
  })
  .finally(() => {
    db.query('SELECT 1').then(() => process.exit(0));
  });
