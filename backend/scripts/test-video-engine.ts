/**
 * Integration test for Chunk 3: Video Engine (fal.ai Seedance 2.0)
 *
 * Prerequisites:
 *   - FAL_KEY filled in .env
 *   - Docker DB running (docker-compose up -d)
 *   - Existing facts.json at data/runs/HDO_META_Rome_A3_problem_UGC_EN_v01/facts.json
 *     (produced by running the script engine test first)
 *
 * Run:
 *   cd backend && npx ts-node --transpile-only scripts/test-video-engine.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import fs from 'fs/promises';
import { db } from '../src/db';
import { generateAllVideoClips } from '../src/services/fal-client';
import type { ScriptJson, FactsJson } from '../src/types';

// ── Config ──────────────────────────────────────────────────────────────────

const AD_ID = 'TEST_VideoEngine_Colosseum_v01';
const FACTS_PATH = path.resolve(
  __dirname,
  '../../data/runs/HDO_META_Rome_A3_problem_UGC_EN_v01/facts.json',
);

// ── Mock script — new schema with shot_type + photo_reference_indices ────────
//
// 4 content scenes (hook + 2×body + payoff) + 1 cta = 5 total
// Colosseum photos: 0=exterior, 3=arena floor, 4=colosseum, 7=roman forum, 11=tourist w/ audio guide

const mockScript: ScriptJson = {
  ad_id: AD_ID,
  metadata: {
    experience_id: '7148',
    persona: 'solo',
    journey_type: 'pre_trip',
    brand: 'headout',
    angle: 'A3',
    hook: 'problem',
    video_format: '9:16',
  },
  video_script: {
    global_style: {
      creator_description:
        'Late-20s solo female traveller, olive-toned Mediterranean skin, loose terracotta linen shirt tucked into high-waisted white shorts, small tan leather crossbody bag, round tortoiseshell sunglasses pushed up on her head, genuine wide-eyed excited energy — talking straight to the camera like a best friend',
      aesthetic:
        'UGC handheld 9:16 vertical, warm sunny Roman midday light with golden undertones, slightly shaky self-shot camera, close-to-face talking-head moments mixed with sweeping POV pans, cinematic but raw and authentic',
      background_music_volume: [0.18, 0.15, 0.2, 0.4],
    },
    scenes: [
      {
        scene_id: 1,
        beat: 'hook',
        shot_type: 'ugc_creator',
        duration_sec: 5,
        visual_direction:
          'Creator holds phone in selfie mode outside the Colosseum, wide-eyed expression, long tourist queue visible over her shoulder. She shakes her head slowly then looks directly into the lens. Handheld close crop on her face, slight zoom in for emphasis.',
        text_overlay: 'Going to Rome and dreading the Colosseum queue?',
        photo_reference_indices: [0],
      },
      {
        scene_id: 2,
        beat: 'body',
        shot_type: 'b_roll',
        duration_sec: 8,
        visual_direction:
          'Slow cinematic tracking shot through the Colosseum interior — ancient stone tiers rising above, arena floor visible below, golden light flooding through the arches. Camera tilts up from floor to sky, then sweeps across the seating tiers. No creator in frame.',
        text_overlay: null,
        photo_reference_indices: [3, 4],
      },
      {
        scene_id: 3,
        beat: 'body',
        shot_type: 'pov',
        duration_sec: 8,
        visual_direction:
          'First-person POV walking through the Roman Forum ruins — camera drifts past ancient columns and temple remnants, slightly shaky handheld iPhone style. The creator\'s hand occasionally gestures toward a ruin. Warm golden afternoon light, slow reveal of Palatine Hill in the distance.',
        text_overlay: null,
        photo_reference_indices: [7],
      },
      {
        scene_id: 4,
        beat: 'payoff',
        shot_type: 'ugc_creator',
        duration_sec: 6,
        visual_direction:
          'Creator stands at the edge of the Roman Forum, turns from the view back to the camera, hand on heart, visibly emotional. Camera drifts slightly — feels spontaneous and real. She shakes her head in disbelief, smiling.',
        text_overlay: 'Colosseum + Roman Forum + Palatine Hill. One pass.',
        photo_reference_indices: [7],
      },
      {
        scene_id: 5,
        beat: 'cta',
        shot_type: 'experience_detail',
        duration_sec: 4,
        visual_direction: '',
        text_overlay: null,
        photo_reference_indices: [],
      },
    ],
    total_duration_sec: 31,
  },
  audio_script: {
    vo_segments: [
      {
        scene_id: 1,
        beat: 'hook',
        vo_text: "Going to Rome and dreading the Colosseum queue? Yeah, I used to too.",
        target_duration_sec: 5,
        pacing: 'fast, punchy',
      },
      {
        scene_id: 2,
        beat: 'body',
        vo_text:
          "I booked skip-the-line timed entry on Headout for just nineteen euros ninety. Walked straight past the queue, straight into one of the most incredible places I have ever been.",
        target_duration_sec: 8,
        pacing: 'building, conversational',
      },
      {
        scene_id: 3,
        beat: 'body',
        vo_text:
          "And the ticket covers the Roman Forum and Palatine Hill for twenty four hours. So I came back at golden hour and had the whole place almost to myself.",
        target_duration_sec: 8,
        pacing: 'warm, reflective',
      },
      {
        scene_id: 4,
        beat: 'payoff',
        vo_text:
          "Genuinely the best nineteen euros I have ever spent. Free cancellation, rated four point four stars from over twenty six thousand travellers. Link in bio.",
        target_duration_sec: 6,
        pacing: 'confident, punchy',
      },
    ],
    tone: 'energetic, conversational, UGC creator voice',
    total_duration_target_sec: 27,
  },
  end_card: {
    price_display: '€19.90',
    rating_display: '4.4★',
    review_count_display: '26,773+ reviews',
    cta_text: 'Book on Headout',
    brand_logo: true,
    cancellation_text: 'Free cancellation',
  },
  claim_sources: {
    '€19.90': 'facts.price.display',
    '4.4★': 'facts.rating',
    '26,773+ reviews': 'facts.review_count',
    '4.4 stars': 'facts.rating',
    'twenty six thousand': 'facts.review_count',
    'nineteen euros ninety': 'facts.price.display',
  },
};

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Chunk 3: Video Engine Test ===\n');

  if (!process.env.FAL_KEY) {
    console.error('❌  FAL_KEY is not set in .env — cannot call fal.ai');
    process.exit(1);
  }

  // Load real facts.json
  let facts: FactsJson;
  try {
    const raw = await fs.readFile(FACTS_PATH, 'utf-8');
    facts = JSON.parse(raw) as FactsJson;
    console.log(`✅  Loaded facts.json — ${facts.title} (${facts.photos.length} photos)`);
  } catch {
    console.error(`❌  facts.json not found at ${FACTS_PATH}`);
    console.error('    Run the script engine test first: npx ts-node --transpile-only src/test-script-engine.ts');
    process.exit(1);
  }

  // Insert a throwaway run record so stage_logs FK constraint is satisfied
  const runRes = await db.query(
    `INSERT INTO runs (ad_id, experience_id, persona, journey_type, brand, angle_id, hook_id, video_format, status, current_stage)
     VALUES ($1, '7148', 'solo', 'pre_trip', 'headout', 'A3', 'problem', '9:16', 'generating', 'video_gen')
     ON CONFLICT (ad_id) DO UPDATE SET status = 'generating', current_stage = 'video_gen'
     RETURNING id`,
    [AD_ID],
  );
  const runId = runRes.rows[0].id as number;
  console.log(`✅  Test run record — id=${runId}, ad_id=${AD_ID}`);

  const contentScenes = mockScript.video_script.scenes.filter(s => s.beat !== 'cta');
  console.log(`\n🎬  Generating ${contentScenes.length} clips in parallel...`);
  console.log(`    CREATOR_PHOTO_URL: ${process.env.CREATOR_PHOTO_URL || '(not set — ugc_creator scenes use venue photo)'}`);
  console.log('    Scenes:');
  for (const s of contentScenes) {
    console.log(`      scene ${s.scene_id}: ${s.beat} | ${s.shot_type} | ${s.duration_sec}s | photos: [${s.photo_reference_indices}]`);
  }
  console.log('');

  const start = Date.now();

  try {
    const clips = await generateAllVideoClips(mockScript, facts, runId, AD_ID);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅  Done in ${elapsed}s — ${clips.length}/${contentScenes.length} clips generated\n`);

    for (const clip of clips) {
      const stat = await fs.stat(clip.file_path);
      const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
      console.log(`  Scene ${clip.scene_id} (${clip.beat}/${clip.shot_type})`);
      console.log(`    local : ${clip.file_path}`);
      console.log(`    remote: ${clip.remote_url}`);
      console.log(`    size  : ${sizeMb} MB | duration: ${clip.duration_sec}s`);
    }

    // Cost summary from stage_logs
    const costRes = await db.query(
      `SELECT SUM(cost_usd) as total FROM stage_logs WHERE run_id = $1 AND stage LIKE 'video_gen%'`,
      [runId],
    );
    const total = parseFloat(costRes.rows[0].total ?? '0');
    console.log(`\n💰  Estimated video cost: $${total.toFixed(4)}`);
    console.log('\n🎉  Chunk 3 test passed.');

  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n❌  Video generation failed after ${elapsed}s:`, (err as Error).message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
