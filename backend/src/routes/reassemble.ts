import { Router, Request, Response } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware';
import { assembleAd } from '../services/remotion-client';
import { exportAndFinalize } from '../orchestrator';
import type { VideoClipResult, VoSegmentResult, ScriptJson, UserInput, FactsJson, ClaimReport } from '../types';

const router = Router();

// POST /api/runs/:ad_id/reassemble
// Re-runs only the assembly stage using already-generated clips + VO from stage_logs.
// Safe to call multiple times on a failed run.
router.post('/runs/:ad_id/reassemble', asyncHandler(async (req: Request, res: Response) => {
  const { ad_id } = req.params;

  // 1. Load run
  const runRes = await db.query(
    `SELECT id, status, script, facts, claim_report,
            persona, journey_type, brand, angle_id, hook_id, video_format, additional_details
     FROM runs WHERE ad_id = $1`,
    [ad_id],
  );
  if (!runRes.rows[0]) {
    return res.status(404).json({ error: `Run not found: ${ad_id}` });
  }

  const run = runRes.rows[0];

  if (run.status !== 'failed') {
    return res.status(409).json({
      error: `Run is not in a failed state (current: ${run.status}). Only failed runs can be reassembled.`,
    });
  }

  if (!run.script) {
    return res.status(422).json({ error: 'Run has no script — cannot reassemble.' });
  }

  // 2. Reconstruct VideoClipResult[] from completed video_gen_scene_* stage logs
  const clipLogsRes = await db.query(
    `SELECT stage, params, result FROM stage_logs
     WHERE run_id = $1 AND stage LIKE 'video_gen_scene_%' AND status = 'completed'
     ORDER BY id`,
    [run.id],
  );

  if (clipLogsRes.rows.length === 0) {
    return res.status(422).json({ error: 'No completed video clips found — nothing to reassemble.' });
  }

  const clips: VideoClipResult[] = clipLogsRes.rows.map((row) => {
    const params = row.params as Record<string, unknown>;
    const result = row.result as Record<string, unknown>;
    return {
      scene_id: params.scene_id as number,
      beat: params.beat as string,
      shot_type: params.shot_type as VideoClipResult['shot_type'],
      file_path: result.file_path as string,
      remote_url: (result.remote_url ?? '') as string,
      duration_sec: result.duration_sec as number,
    };
  });

  // 3. Reconstruct VoSegmentResult[] from completed audio_gen_scene_* stage logs
  const voLogsRes = await db.query(
    `SELECT stage, result FROM stage_logs
     WHERE run_id = $1 AND stage LIKE 'audio_gen_scene_%' AND status = 'completed'
     ORDER BY id`,
    [run.id],
  );

  const voSegments: VoSegmentResult[] = voLogsRes.rows.map((row) => {
    const result = row.result as Record<string, unknown>;
    const sceneId = parseInt((row.stage as string).replace('audio_gen_scene_', ''), 10);
    return {
      scene_id: sceneId,
      file_path: result.file_path as string,
      duration_sec: (result.actual_duration_sec ?? result.target_duration_sec ?? 0) as number,
      characters: (result.characters ?? 0) as number,
    };
  });

  // 4. Reconstruct UserInput from run columns
  const userInput: UserInput = {
    experience_id: run.script.metadata?.experience_id ?? '',
    persona: run.persona,
    journey_type: run.journey_type,
    brand: run.brand,
    angle: run.angle_id,
    hook: run.hook_id,
    video_format: run.video_format,
    ...(run.additional_details ? { additional_details: run.additional_details } : {}),
  };

  const script = run.script as ScriptJson;
  const runId: number = run.id;

  // 5. Clean up stale assembly artifacts so a fresh attempt starts clean
  await db.query(
    `DELETE FROM stage_logs WHERE run_id = $1 AND stage = 'assembly'`,
    [runId],
  );
  await db.query(
    `DELETE FROM assets WHERE run_id = $1`,
    [runId],
  );

  // 6. Reset run to assembling state
  await db.query(
    `UPDATE runs
     SET status = 'assembling', current_stage = 'assembly',
         error_message = NULL, completed_at = NULL
     WHERE id = $1`,
    [runId],
  );

  // 7. Respond immediately — client polls /api/status/:ad_id as usual
  res.json({ ad_id, run_id: runId });

  // 8. Run assembly + finalize async (fire and forget)
  reassembleAsync(runId, ad_id, clips, voSegments, script, userInput, run.facts as FactsJson, run.claim_report as ClaimReport).catch((err) => {
    console.error(`[reassemble:${ad_id}] Failed:`, (err as Error).message);
  });
}));

async function reassembleAsync(
  runId: number,
  adId: string,
  clips: VideoClipResult[],
  voSegments: VoSegmentResult[],
  script: ScriptJson,
  userInput: UserInput,
  facts: FactsJson,
  claimReport: ClaimReport,
): Promise<void> {
  try {
    console.log(`[reassemble:${adId}] Starting assembly with ${clips.length} clips, ${voSegments.length} VO segments`);
    const assembly = await assembleAd(clips, voSegments, script, userInput, runId, adId);
    console.log(`[reassemble:${adId}] Assembly OK — ${assembly.files.length} output file(s)`);

    await db.query(
      `UPDATE runs SET status = 'exporting', current_stage = 'export' WHERE id = $1`,
      [runId],
    );

    await exportAndFinalize(assembly, script, facts, claimReport, runId, adId);

    await db.query(
      `UPDATE runs SET status = 'completed', current_stage = NULL WHERE id = $1`,
      [runId],
    );
    console.log(`[reassemble:${adId}] COMPLETED`);
  } catch (err) {
    await db.query(
      `UPDATE runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
      [(err as Error).message, runId],
    ).catch(() => {});
    throw err;
  }
}

export default router;
