import { Router, Request, Response } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware';

const router = Router();

// GET /api/output/:ad_id
// Returns final output after status = 'completed'
router.get('/output/:ad_id', asyncHandler(async (req: Request, res: Response) => {
  const { ad_id } = req.params;

  const runRes = await db.query(
    `SELECT id, ad_id, experience_id, status, error_message,
            total_cost_usd, script, claim_report, facts,
            created_at, completed_at
     FROM runs WHERE ad_id = $1`,
    [ad_id],
  );

  if (!runRes.rows[0]) {
    return res.status(404).json({ error: `Run not found: ${ad_id}` });
  }

  const run = runRes.rows[0];

  if (run.status !== 'completed') {
    return res.status(409).json({
      error: `Run is not completed yet (status: ${run.status})`,
      status: run.status,
      error_message: run.error_message ?? null,
    });
  }

  // Final video assets
  const assetsRes = await db.query(
    `SELECT format, file_path, file_size, duration_sec
     FROM assets WHERE run_id = $1 AND asset_type = 'final_video'
     ORDER BY format`,
    [run.id],
  );

  const videos = assetsRes.rows.map(a => ({
    format: a.format,
    // Serve via Express static at /data/runs/{ad_id}/output/{format}
    url: `/data/runs/${ad_id}/output/${a.format.replace(':', 'x')}.mp4`,
    duration_sec: parseFloat(a.duration_sec),
    file_size: a.file_size,
  }));

  // Cost breakdown from stage_logs
  const stagesRes = await db.query(
    `SELECT stage, service, model, cost_usd
     FROM stage_logs WHERE run_id = $1 ORDER BY id`,
    [run.id],
  );

  const byStage = stagesRes.rows.map(s => ({
    stage: s.stage,
    service: s.service ?? null,
    model: s.model ?? null,
    cost_usd: parseFloat(s.cost_usd ?? '0'),
  }));

  const byService: Record<string, number> = {};
  for (const s of byStage) {
    const svc = s.service ?? 'unknown';
    byService[svc] = (byService[svc] ?? 0) + s.cost_usd;
  }

  return res.json({
    ad_id: run.ad_id,
    run_id: run.id,
    experience_id: run.experience_id,
    status: run.status,
    completed_at: run.completed_at,
    videos,
    cost_breakdown: {
      total: parseFloat(run.total_cost_usd ?? '0'),
      by_service: byService,
      by_stage: byStage,
    },
    claim_report: run.claim_report ?? null,
    script: run.script ?? null,
    facts: run.facts ?? null,
  });
}));

export default router;
