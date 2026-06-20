import { Router, Request, Response } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware';

const router = Router();

// GET /api/runs
// List all pipeline runs (filterable, paginated)
router.get('/runs', asyncHandler(async (req: Request, res: Response) => {
  const { status, experience_id, limit = '20', offset = '0' } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }
  if (experience_id) {
    conditions.push(`experience_id = $${idx++}`);
    params.push(experience_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const lim = Math.min(Math.max(1, parseInt(String(limit), 10) || 20), 100);
  const off = Math.max(0, parseInt(String(offset), 10) || 0);

  params.push(lim, off);

  const result = await db.query(
    `SELECT ad_id, experience_id, angle_id, hook_id, persona, video_format,
            status, total_cost_usd, created_at, completed_at,
            EXTRACT(EPOCH FROM (completed_at - created_at))::int AS duration_sec
     FROM runs
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params,
  );

  return res.json(
    result.rows.map(r => ({
      ad_id: r.ad_id,
      experience_id: r.experience_id,
      angle: r.angle_id,
      hook: r.hook_id,
      persona: r.persona,
      video_format: r.video_format,
      status: r.status,
      total_cost_usd: parseFloat(r.total_cost_usd ?? '0'),
      created_at: r.created_at,
      completed_at: r.completed_at ?? null,
      duration_sec: r.duration_sec ?? null,
    })),
  );
}));

// GET /api/runs/:ad_id/cost
// Detailed cost breakdown for a single run
router.get('/runs/:ad_id/cost', asyncHandler(async (req: Request, res: Response) => {
  const { ad_id } = req.params;

  const runRes = await db.query(
    'SELECT id, total_cost_usd FROM runs WHERE ad_id = $1',
    [ad_id],
  );
  if (!runRes.rows[0]) {
    return res.status(404).json({ error: `Run not found: ${ad_id}` });
  }

  const run = runRes.rows[0];

  const stagesRes = await db.query(
    `SELECT stage, service, model, cost_usd, duration_ms, params
     FROM stage_logs WHERE run_id = $1 ORDER BY id`,
    [run.id],
  );

  const byService: Record<string, number> = {};
  for (const s of stagesRes.rows) {
    const svc = s.service ?? 'unknown';
    byService[svc] = (byService[svc] ?? 0) + parseFloat(s.cost_usd ?? '0');
  }

  return res.json({
    ad_id,
    total: parseFloat(run.total_cost_usd ?? '0'),
    by_service: byService,
    by_stage: stagesRes.rows.map(s => ({
      stage: s.stage,
      service: s.service ?? null,
      model: s.model ?? null,
      cost_usd: parseFloat(s.cost_usd ?? '0'),
      duration_ms: s.duration_ms ?? null,
      params: s.params ?? null,
    })),
  });
}));

export default router;
