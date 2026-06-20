import { Router, Request, Response } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware';

const router = Router();

// GET /api/config/angles
// Includes sub_format + journey + brand_lean for script engine and frontend filtering
router.get('/config/angles', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.query(
    `SELECT id, name, description, example_line, sub_format, journey, brand_lean
     FROM angles ORDER BY sort_order, id`,
  );
  return res.json(result.rows);
}));

// GET /api/config/hooks
router.get('/config/hooks', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.query(
    'SELECT id, name, template, description FROM hooks ORDER BY sort_order, id',
  );
  return res.json(result.rows);
}));

// GET /api/config/personas
router.get('/config/personas', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.query(
    'SELECT id, name, description FROM personas ORDER BY sort_order, id',
  );
  return res.json(result.rows);
}));

// GET /api/config/angle-hook-map
// Dependent dropdown: given an angle, which hooks are recommended vs works?
// Returns: { [angleId]: { recommended: string[], works: string[] } }
router.get('/config/angle-hook-map', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.query(
    `SELECT value FROM config WHERE key = 'angle_hook_map'`,
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'angle_hook_map not seeded' });
  return res.json(result.rows[0].value);
}));

// GET /api/config/persona-angle-map
// Smart angle ordering: given a persona, which angles are recommended vs works?
// Returns: { [personaId]: { recommended: string[], works: string[] } }
router.get('/config/persona-angle-map', asyncHandler(async (_req: Request, res: Response) => {
  const result = await db.query(
    `SELECT value FROM config WHERE key = 'persona_angle_map'`,
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'persona_angle_map not seeded' });
  return res.json(result.rows[0].value);
}));

export default router;
