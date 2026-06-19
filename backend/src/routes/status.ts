import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// GET /api/status/:ad_id
// Polled by the frontend every 2s after POST /api/generate
router.get('/status/:ad_id', async (req: Request, res: Response) => {
  const { ad_id } = req.params;

  const runRes = await db.query(
    `SELECT id, ad_id, status, current_stage, total_cost_usd, error_message,
            created_at, completed_at
     FROM runs WHERE ad_id = $1`,
    [ad_id],
  );

  if (!runRes.rows[0]) {
    return res.status(404).json({ error: `Run not found: ${ad_id}` });
  }

  const run = runRes.rows[0];

  const stagesRes = await db.query(
    `SELECT stage, status, service, cost_usd, duration_ms, started_at, completed_at
     FROM stage_logs WHERE run_id = $1 ORDER BY id`,
    [run.id],
  );

  return res.json({
    ad_id: run.ad_id,
    run_id: run.id,
    status: run.status,
    current_stage: run.current_stage,
    total_cost_usd: parseFloat(run.total_cost_usd ?? '0'),
    error_message: run.error_message ?? null,
    created_at: run.created_at,
    completed_at: run.completed_at ?? null,
    stages: stagesRes.rows.map(s => ({
      stage: s.stage,
      status: s.status,
      service: s.service ?? null,
      cost_usd: parseFloat(s.cost_usd ?? '0'),
      duration_ms: s.duration_ms ?? null,
      started_at: s.started_at,
      completed_at: s.completed_at ?? null,
    })),
  });
});

export default router;
