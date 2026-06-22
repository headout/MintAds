import path from 'path';
import fs from 'fs/promises';
import { db } from './db';
import { fetchExperienceFacts } from './services/headout-client';
import { generateScript } from './script-engine';
import { generateAllVoSegments } from './services/elevenlabs-client';
import { generateVideoClips } from './services/fal-client';
import { assembleAd } from './services/remotion-client';
import { DATA_RUNS_DIR } from './paths';
import type {
  UserInput,
  FactsJson,
  ScriptJson,
  ClaimReport,
  VideoClipResult,
  AssemblyResult,
} from './types';

// ---------------------------------------------------------------------------
// Ad ID generation
// ---------------------------------------------------------------------------

// Generates a stable ad_id from user inputs alone — no facts required.
// Used as the DB key and API identifier throughout the run's lifetime.
// The script.json's internal ad_id (set by Claude using the city name) is a
// separate display label; the DB ad_id is the source of truth for routing.
function generateRunAdId(userInput: UserInput): string {
  const expSlug = String(userInput.experience_id)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12);
  const angle = userInput.angle.replace(/[^a-zA-Z0-9]/g, '');
  const hook = userInput.hook.replace(/[^a-zA-Z0-9_]/g, '');
  const ts = String(Date.now()).slice(-4);
  return `HDO_META_${expSlug}_${angle}_${hook}_UGC_EN_v${ts}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateRunStatus(runId: number, status: string, stage?: string): Promise<void> {
  await db.query(
    `UPDATE runs SET status = $1, current_stage = COALESCE($2, current_stage) WHERE id = $3`,
    [status, stage ?? null, runId],
  );
}

async function checkBudget(runId: number, adId: string): Promise<void> {
  const res = await db.query(
    'SELECT total_cost_usd FROM runs WHERE id = $1',
    [runId],
  );
  const cost = parseFloat(res.rows[0]?.total_cost_usd ?? '0');
  if (cost > 10) {
    console.warn(`[pipeline] Budget warning: ${adId} has spent $${cost.toFixed(2)} (target < $10)`);
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint — creates the DB row synchronously, then fires async pipeline
// ---------------------------------------------------------------------------

/**
 * Creates a run record immediately (so the caller gets a stable adId + runId
 * to return to the client), then starts the pipeline in the background.
 */
export async function startPipeline(
  userInput: UserInput,
): Promise<{ runId: number; adId: string }> {
  const adId = generateRunAdId(userInput);

  const runRes = await db.query(
    `INSERT INTO runs
       (ad_id, experience_id, persona, journey_type, brand, angle_id, hook_id,
        video_format, additional_details, status, current_stage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','content_ingestion')
     RETURNING id`,
    [
      adId,
      userInput.experience_id,
      userInput.persona,
      userInput.journey_type,
      userInput.brand,
      userInput.angle,
      userInput.hook,
      userInput.video_format,
      userInput.additional_details ?? null,
    ],
  );
  const runId: number = runRes.rows[0].id;

  // Fire and forget — errors are caught and written to the run record
  runPipelineAsync(runId, adId, userInput).catch(err => {
    console.error(`[pipeline] Run ${runId} (${adId}) failed:`, err.message);
  });

  return { runId, adId };
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

async function runPipelineAsync(
  runId: number,
  adId: string,
  userInput: UserInput,
): Promise<void> {
  try {
    // 1. Content Ingestion
    console.log(`[pipeline:${adId}] Starting content ingestion`);
    await updateRunStatus(runId, 'ingesting', 'content_ingestion');
    const facts = await fetchExperienceFacts(userInput.experience_id, runId, adId);
    console.log(`[pipeline:${adId}] Content ingestion OK — "${facts.title}"`);

    // 2. Resolve angle + hook descriptions from DB
    const [angleRow, hookRow] = await Promise.all([
      db.query(
        'SELECT id, name, description, example_line, sub_format, journey, brand_lean FROM angles WHERE id = $1',
        [userInput.angle],
      ),
      db.query(
        'SELECT id, name, template, description FROM hooks WHERE id = $1',
        [userInput.hook],
      ),
    ]);

    if (!angleRow.rows[0]) throw new Error(`Angle '${userInput.angle}' not found`);
    if (!hookRow.rows[0]) throw new Error(`Hook '${userInput.hook}' not found`);

    // 3. Script Generation + Validation
    console.log(`[pipeline:${adId}] Starting script generation (angle=${userInput.angle}, hook=${userInput.hook})`);
    await updateRunStatus(runId, 'scripting', 'script_gen');
    const { script, claim_report } = await generateScript(
      facts,
      userInput,
      angleRow.rows[0],
      hookRow.rows[0],
      runId,
      adId,
    );
    console.log(`[pipeline:${adId}] Script generation OK — ${script.video_script.scenes.length} scenes, ${script.video_script.total_duration_sec}s`);

    // 4. Video + Audio fan-out
    console.log(`[pipeline:${adId}] Starting video + audio generation`);
    await updateRunStatus(runId, 'generating', 'video_gen + audio_gen');

    const contentScenes = script.video_script.scenes.filter(s => s.beat !== 'cta');
    const nonLipSyncScenes = contentScenes.filter(s => !s.lip_sync);
    const lipSyncScenes = contentScenes.filter(s => s.lip_sync);

    // Step 1: VO segments + non-lip-sync clips in parallel
    const [voSegments, nonLipSyncClips] = await Promise.all([
      generateAllVoSegments(script, adId, runId),
      nonLipSyncScenes.length > 0
        ? generateVideoClips(nonLipSyncScenes, script, facts, runId, adId)
        : Promise.resolve<VideoClipResult[]>([]),
    ]);
    console.log(`[pipeline:${adId}] Audio OK — ${voSegments.length} VO segments`);
    console.log(`[pipeline:${adId}] Non-lip-sync video OK — ${nonLipSyncClips.length} clips`);

    // Step 2: Lip-sync clips — needs VO segments from Step 1
    let lipSyncClips: VideoClipResult[] = [];
    if (lipSyncScenes.length > 0) {
      lipSyncClips = await generateVideoClips(
        lipSyncScenes, script, facts, runId, adId, voSegments,
      );
      console.log(`[pipeline:${adId}] Lip-sync video OK — ${lipSyncClips.length} clips`);
    }

    const allClips = [...nonLipSyncClips, ...lipSyncClips].sort((a, b) => a.scene_id - b.scene_id);
    console.log(`[pipeline:${adId}] All ${allClips.length} video clips ready`);

    // Budget check after video generation (most expensive stage)
    await checkBudget(runId, adId);

    // 5. Assembly
    console.log(`[pipeline:${adId}] Starting assembly`);
    await updateRunStatus(runId, 'assembling', 'assembly');
    const assembly = await assembleAd(allClips, voSegments, script, userInput, runId, adId);
    console.log(`[pipeline:${adId}] Assembly OK — ${assembly.files.length} output file(s)`);

    // 6. Export & Finalize
    console.log(`[pipeline:${adId}] Starting export`);
    await updateRunStatus(runId, 'exporting', 'export');
    await exportAndFinalize(assembly, script, facts, claim_report, runId, adId);

    // Mark completed (total_cost_usd already set by exportAndFinalize)
    await db.query(
      `UPDATE runs SET status = 'completed', current_stage = NULL WHERE id = $1`,
      [runId],
    );
    console.log(`[pipeline:${adId}] COMPLETED (run ${runId})`);

  } catch (error) {
    console.error(`[pipeline:${adId}] FAILED (run ${runId}): ${(error as Error).message}`);
    await db.query(
      `UPDATE runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
      [(error as Error).message, runId],
    ).catch(() => {});
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Export & Finalize
// ---------------------------------------------------------------------------

async function exportAndFinalize(
  assembly: AssemblyResult,
  script: ScriptJson,
  facts: FactsJson,
  claimReport: ClaimReport,
  runId: number,
  adId: string,
): Promise<void> {
  const runDir = path.join(DATA_RUNS_DIR, adId);
  await fs.mkdir(runDir, { recursive: true });

  // claim_report.json (facts.json + script.json are written by their engines)
  await fs.writeFile(
    path.join(runDir, 'claim_report.json'),
    JSON.stringify(claimReport, null, 2),
  );

  // Insert asset records
  for (const file of assembly.files) {
    await db.query(
      `INSERT INTO assets (run_id, ad_id, asset_type, format, file_path, file_size, duration_sec)
       VALUES ($1, $2, 'final_video', $3, $4, $5, $6)`,
      [runId, adId, file.format, file.file_path, file.file_size, file.duration_sec],
    );
  }

  // Compute total cost from stage_logs
  const costRes = await db.query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM stage_logs WHERE run_id = $1`,
    [runId],
  );
  const totalCost = parseFloat(costRes.rows[0].total);

  // Write cost_breakdown.json
  const breakdownRes = await db.query(
    `SELECT stage, service, model, cost_usd, params FROM stage_logs WHERE run_id = $1 ORDER BY id`,
    [runId],
  );
  await fs.writeFile(
    path.join(runDir, 'cost_breakdown.json'),
    JSON.stringify(
      { ad_id: adId, total_cost_usd: totalCost, breakdown: breakdownRes.rows },
      null,
      2,
    ),
  );

  // Update run with final cost + completion time
  await db.query(
    `UPDATE runs SET total_cost_usd = $1, completed_at = NOW() WHERE id = $2`,
    [totalCost, runId],
  );
}
