import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { db } from '../db';
import type { VoSegment, VoSegmentResult, ScriptJson } from '../types';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb';
const MODEL_ID = 'eleven_multilingual_v2';
const COST_PER_1K_CHARS = 0.03;

// Warn (but don't fail) if actual VO duration drifts more than this from target
const DURATION_WARN_THRESHOLD_SEC = 3;

const DATA_RUNS_DIR = path.resolve(__dirname, '../../../data/runs');

// ---------------------------------------------------------------------------
// ElevenLabs client (lazy init)
// ---------------------------------------------------------------------------

let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (!client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
    client = new ElevenLabsClient({ apiKey });
  }
  return client;
}

// ---------------------------------------------------------------------------
// ffprobe duration
// ---------------------------------------------------------------------------

async function getAudioDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const secs = parseFloat(stdout.trim());
    return isNaN(secs) ? null : secs;
  } catch (err) {
    // ffprobe not in PATH — duration check skipped; assembly uses target_duration_sec
    const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'ffprobe not found in PATH — install ffmpeg to enable duration checks'
      : (err as Error).message;
    console.warn(`[elevenlabs] duration check skipped: ${msg}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB stage log helpers (mirrors fal-client pattern)
// ---------------------------------------------------------------------------

async function openStageLog(
  runId: number,
  adId: string,
  stage: string,
  params: object,
): Promise<number> {
  const res = await db.query(
    `INSERT INTO stage_logs (run_id, ad_id, stage, status, service, cost_usd, params)
     VALUES ($1, $2, $3, 'in_progress', 'elevenlabs', 0, $4)
     RETURNING id`,
    [runId, adId, stage, JSON.stringify(params)],
  );
  return res.rows[0].id as number;
}

async function closeStageLog(
  logId: number,
  durationMs: number,
  costUsd: number,
  result: object,
): Promise<void> {
  await db.query(
    `UPDATE stage_logs
     SET status='completed', completed_at=NOW(), duration_ms=$1, cost_usd=$2, result=$3
     WHERE id=$4`,
    [durationMs, costUsd, JSON.stringify(result), logId],
  );
}

async function failStageLog(logId: number, durationMs: number, error: string): Promise<void> {
  await db.query(
    `UPDATE stage_logs
     SET status='failed', completed_at=NOW(), duration_ms=$1, result=$2
     WHERE id=$3`,
    [durationMs, JSON.stringify({ error }), logId],
  );
}

// ---------------------------------------------------------------------------
// Single-segment generation
// ---------------------------------------------------------------------------

/**
 * Generate one ElevenLabs TTS segment and write it to disk.
 *
 * The segment text gets an SSML <break> appended if pause_after_sec is set,
 * creating a natural beat-boundary pause without introducing silence seams
 * in the Remotion audio layering.
 */
export async function generateVoSegment(
  segment: VoSegment,
  adId: string,
  runId: number,
): Promise<VoSegmentResult> {
  const stage = `audio_gen_scene_${segment.scene_id}`;
  const localPath = path.join(
    DATA_RUNS_DIR,
    adId,
    `vo_${String(segment.scene_id).padStart(3, '0')}.mp3`,
  );

  const logId = await openStageLog(runId, adId, stage, {
    scene_id: segment.scene_id,
    beat: segment.beat,
    target_duration_sec: segment.target_duration_sec,
    characters: segment.vo_text.length,
    voice_id: VOICE_ID,
    model_id: MODEL_ID,
  });

  const t = Date.now();

  try {
    // Append SSML break for beat-boundary pause
    const text = segment.pause_after_sec
      ? `${segment.vo_text} <break time="${Math.round(segment.pause_after_sec * 1000)}ms"/>`
      : segment.vo_text;

    await fs.mkdir(path.dirname(localPath), { recursive: true });

    console.log(
      `[elevenlabs] Scene ${segment.scene_id} (${segment.beat}): generating VO — ${segment.vo_text.length} chars, target ${segment.target_duration_sec}s`,
    );

    const audioStream = await getClient().textToSpeech.convert(VOICE_ID, {
      text,
      modelId: MODEL_ID,
      voiceSettings: {
        stability: 0.35,
        similarityBoost: 0.75,
        style: 0.5,
        useSpeakerBoost: true,
      },
    });

    // Stream to disk
    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(localPath);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);

      (async () => {
        try {
          for await (const chunk of audioStream) {
            writeStream.write(chunk);
          }
          writeStream.end();
        } catch (err) {
          writeStream.destroy(err as Error);
        }
      })();
    });

    // Sanity: non-zero bytes
    const stats = await fs.stat(localPath);
    if (stats.size === 0) {
      throw new Error(`Scene ${segment.scene_id}: written VO file is 0 bytes`);
    }

    // Duration check via ffprobe (null if ffprobe not installed — falls back to target)
    const actualDuration = await getAudioDuration(localPath);
    const reportedDuration = actualDuration ?? segment.target_duration_sec;

    if (actualDuration !== null) {
      const drift = Math.abs(actualDuration - segment.target_duration_sec);
      if (drift > DURATION_WARN_THRESHOLD_SEC) {
        console.warn(
          `[elevenlabs] Scene ${segment.scene_id}: duration drift ${drift.toFixed(1)}s (actual ${actualDuration.toFixed(1)}s vs target ${segment.target_duration_sec}s)`,
        );
      }
    }

    const costUsd = (segment.vo_text.length / 1000) * COST_PER_1K_CHARS;
    const durationMs = Date.now() - t;

    await closeStageLog(logId, durationMs, costUsd, {
      file_path: localPath,
      actual_duration_sec: actualDuration,
      target_duration_sec: segment.target_duration_sec,
      ...(actualDuration !== null && {
        duration_drift_sec: parseFloat(Math.abs(actualDuration - segment.target_duration_sec).toFixed(2)),
      }),
      characters: segment.vo_text.length,
    });

    console.log(
      `[elevenlabs] Scene ${segment.scene_id} done — ${reportedDuration.toFixed(1)}s, $${costUsd.toFixed(4)} (${durationMs}ms)`,
    );

    return {
      scene_id: segment.scene_id,
      file_path: localPath,
      duration_sec: reportedDuration,
      characters: segment.vo_text.length,
    };
  } catch (err) {
    await failStageLog(logId, Date.now() - t, (err as Error).message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public API — all segments in parallel
// ---------------------------------------------------------------------------

/**
 * Generate ElevenLabs TTS for every vo_segment in the script.
 *
 * Runs all N segments in parallel (wall time ≈ slowest single segment, ~3–5s).
 * Called as Step 1 of the orchestrator's video+audio fan-out alongside non-lip-sync
 * video generation. Lip-sync video generation must await these results.
 *
 * @param script  Full script.json — provides audio_script.vo_segments[]
 * @param adId    Ad ID string for filesystem paths + stage logging
 * @param runId   DB run ID for stage logging + cost accumulation
 */
export async function generateAllVoSegments(
  script: ScriptJson,
  adId: string,
  runId: number,
): Promise<VoSegmentResult[]> {
  const segments = script.audio_script.vo_segments;

  console.log(`[elevenlabs] Generating ${segments.length} VO segments in parallel`);

  const settled = await Promise.allSettled(
    segments.map((seg) => generateVoSegment(seg, adId, runId)),
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<VoSegmentResult> => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = settled.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`[elevenlabs] ${failed.length}/${segments.length} VO segments failed`);
  }

  if (results.length === 0) {
    throw new Error('All VO segment generation calls failed — no audio produced');
  }

  // Accumulate total audio cost on the run record (fulfilled segments only)
  const totalCost = results.reduce((sum, r) => sum + (r.characters / 1000) * COST_PER_1K_CHARS, 0);
  await db.query('UPDATE runs SET total_cost_usd = total_cost_usd + $1 WHERE id = $2', [
    totalCost,
    runId,
  ]);

  console.log(
    `[elevenlabs] ${results.length}/${segments.length} segments done — total audio cost $${totalCost.toFixed(4)}`,
  );

  return results;
}
