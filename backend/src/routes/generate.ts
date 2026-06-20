import { Router, Request, Response } from 'express';
import { startPipeline } from '../orchestrator';
import { db } from '../db';
import { asyncHandler } from '../middleware';
import type { UserInput } from '../types';

const router = Router();

const VALID_JOURNEY_TYPES = ['pre_trip', 'in_trip'];
const VALID_BRANDS = ['headout', 'non_headout'];
const VALID_FORMATS = ['9:16', '1:1', '16:9', 'all'];

router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const {
    experience_id,
    persona,
    journey_type,
    brand,
    angle,
    hook,
    video_format,
    additional_details,
  } = req.body;

  // --- Validation ---
  const missing: string[] = [];
  if (!experience_id) missing.push('experience_id');
  if (!persona) missing.push('persona');
  if (!journey_type) missing.push('journey_type');
  if (!brand) missing.push('brand');
  if (!angle) missing.push('angle');
  if (!hook) missing.push('hook');
  if (!video_format) missing.push('video_format');

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  if (!VALID_JOURNEY_TYPES.includes(journey_type)) {
    return res.status(400).json({ error: `journey_type must be one of: ${VALID_JOURNEY_TYPES.join(', ')}` });
  }
  if (!VALID_BRANDS.includes(brand)) {
    return res.status(400).json({ error: `brand must be one of: ${VALID_BRANDS.join(', ')}` });
  }
  if (!VALID_FORMATS.includes(video_format)) {
    return res.status(400).json({ error: `video_format must be one of: ${VALID_FORMATS.join(', ')}` });
  }
  if (additional_details && typeof additional_details === 'string' && additional_details.length > 500) {
    return res.status(400).json({ error: 'additional_details exceeds 500 characters' });
  }

  // Check persona exists
  const personaRow = await db.query('SELECT id FROM personas WHERE id = $1', [persona]);
  if (!personaRow.rows[0]) {
    return res.status(400).json({ error: `Unknown persona: '${persona}'` });
  }

  // Check angle exists
  const angleRow = await db.query('SELECT id FROM angles WHERE id = $1', [angle]);
  if (!angleRow.rows[0]) {
    return res.status(400).json({ error: `Unknown angle: '${angle}'` });
  }

  // Check hook exists
  const hookRow = await db.query('SELECT id FROM hooks WHERE id = $1', [hook]);
  if (!hookRow.rows[0]) {
    return res.status(400).json({ error: `Unknown hook: '${hook}'` });
  }

  const userInput: UserInput = {
    experience_id: String(experience_id).trim(),
    persona,
    journey_type,
    brand,
    angle,
    hook,
    video_format,
    additional_details: additional_details ? String(additional_details).trim() : undefined,
  };

  try {
    const { runId, adId } = await startPipeline(userInput);
    return res.status(202).json({ ad_id: adId, run_id: runId });
  } catch (err) {
    console.error('[POST /api/generate] Failed to start pipeline:', (err as Error).message);
    return res.status(500).json({ error: 'Failed to start pipeline. Please try again.' });
  }
}));

export default router;
