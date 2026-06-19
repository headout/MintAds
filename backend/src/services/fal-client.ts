import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import https from 'https';
import http from 'http';
import { fal } from '@fal-ai/client';
import { db } from '../db';
import type { SceneJson, GlobalStyle, FactsJson, ScriptJson, VideoClipResult } from '../types';

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const ENDPOINT_REFERENCE = 'bytedance/seedance-2.0/fast/reference-to-video';
const ENDPOINT_IMAGE = 'bytedance/seedance-2.0/fast/image-to-video';

// Cost: $0.2419/sec regardless of endpoint (images-only tier)
const COST_PER_SEC = 0.2419;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

fal.config({ credentials: process.env.FAL_KEY ?? '' });

// Mirrors the convention in script-engine.ts — resolves from __dirname regardless of CWD
const DATA_RUNS_DIR = path.resolve(__dirname, '../../../data/runs');

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildReferencePrompt(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  imageUrls: string[],
  hasCreatorPhoto: boolean,
): string {
  const lines: string[] = [];

  // Label every image — unused references confuse the model
  if (hasCreatorPhoto) {
    lines.push(
      `@Image1 is the creator — maintain their exact appearance (face, hair, outfit, body type) throughout the entire video.`,
    );
    for (let i = 1; i < imageUrls.length; i++) {
      const idx = scene.photo_reference_indices[i - 1];
      const kw = facts.photos[idx]?.keyword ?? 'venue';
      lines.push(`@Image${i + 1} shows: ${kw}.`);
    }
  } else {
    for (let i = 0; i < imageUrls.length; i++) {
      const idx = scene.photo_reference_indices[i];
      const kw = facts.photos[idx]?.keyword ?? 'venue';
      lines.push(`@Image${i + 1} shows: ${kw}.`);
    }
  }

  lines.push('');
  lines.push(`${globalStyle.aesthetic}.`);
  lines.push(`Creator: ${globalStyle.creator_description}.`);
  lines.push(`Location: ${facts.city} — ${facts.title}.`);
  lines.push('Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.');
  lines.push('No speech or lip-sync audio. Silent video only.');
  lines.push('Creator shows only natural authentic human reactions — genuine awe, wonder, excitement.');
  lines.push('No winking, no exaggerated gestures, no theatrical expressions.');
  lines.push('All scenes share the same visual theme and color grade to cut together seamlessly.');
  lines.push('---');
  lines.push(scene.visual_direction);

  return lines.join('\n');
}

function buildImagePrompt(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  imageUrls: string[],
): string {
  const lines: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const idx = scene.photo_reference_indices[i];
    const kw = facts.photos[idx]?.keyword ?? 'venue';
    lines.push(`@Image${i + 1} shows: ${kw}.`);
  }

  lines.push('');
  lines.push(`${globalStyle.aesthetic}.`);
  lines.push(`Location: ${facts.city} — ${facts.title}.`);
  lines.push('Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.');
  lines.push('No speech or lip-sync audio. Silent video only.');
  lines.push('All scenes share the same visual theme and color grade to cut together seamlessly.');
  lines.push('---');
  lines.push(scene.visual_direction);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// File download
// ---------------------------------------------------------------------------

async function downloadFile(url: string, localPath: string): Promise<void> {
  await fs.mkdir(path.dirname(localPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const file = createWriteStream(localPath);
    const transport = url.startsWith('https') ? https : http;

    transport
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          downloadFile(response.headers.location!, localPath).then(resolve).catch(reject);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', async (err) => {
        await fs.unlink(localPath).catch(() => {});
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Single-scene generation
// ---------------------------------------------------------------------------

async function generateClip(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  creatorPhotoUrl: string | null,
  adId: string,
): Promise<VideoClipResult> {
  const isCreatorScene = scene.shot_type === 'ugc_creator';
  const localPath = path.join(
    DATA_RUNS_DIR,
    adId,
    'clips',
    `clip_${String(scene.scene_id).padStart(3, '0')}.mp4`,
  );

  let result: { data: { video: { url: string } } };

  if (isCreatorScene) {
    // reference-to-video: creator photo (@Image1) + venue photos
    const hasCreator = Boolean(creatorPhotoUrl);
    const venueUrls = scene.photo_reference_indices
      .map((idx) => facts.photos[idx]?.url)
      .filter((u): u is string => Boolean(u));

    const imageUrls = hasCreator ? [creatorPhotoUrl!, ...venueUrls] : venueUrls;

    if (imageUrls.length === 0) {
      throw new Error(`Scene ${scene.scene_id}: no images available for ugc_creator scene`);
    }

    const prompt = buildReferencePrompt(scene, globalStyle, facts, imageUrls, hasCreator);

    console.log(
      `[fal] Scene ${scene.scene_id} (${scene.shot_type}) → reference-to-video | ${imageUrls.length} image(s) | ${scene.duration_sec}s`,
    );

    result = await fal.subscribe(ENDPOINT_REFERENCE, {
      input: {
        prompt,
        image_urls: imageUrls,
        resolution: '720p',
        duration: String(scene.duration_sec),
        aspect_ratio: '9:16',
        generate_audio: false,
        bitrate_mode: 'standard',
        end_user_id: 'mintads-headout',
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          process.stdout.write(`\r[fal] Scene ${scene.scene_id}: in progress...`);
        }
      },
    }) as typeof result;
  } else {
    // image-to-video: single venue photo
    const primaryIdx = scene.photo_reference_indices[0] ?? 0;
    const imageUrl = facts.photos[primaryIdx]?.url ?? facts.photos[0]?.url;

    if (!imageUrl) {
      throw new Error(`Scene ${scene.scene_id}: no venue photo available`);
    }

    // For image-to-video, only one photo goes to the model.
    // If a second photo exists in the indices, mention its keyword in the prompt for context.
    const promptImageUrls = [imageUrl];
    const prompt = buildImagePrompt(scene, globalStyle, facts, promptImageUrls);

    console.log(
      `[fal] Scene ${scene.scene_id} (${scene.shot_type}) → image-to-video | 1 image | ${scene.duration_sec}s`,
    );

    result = await fal.subscribe(ENDPOINT_IMAGE, {
      input: {
        prompt,
        image_url: imageUrl,
        resolution: '720p',
        duration: String(scene.duration_sec),
        aspect_ratio: '9:16',
        generate_audio: false,
        bitrate_mode: 'standard',
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          process.stdout.write(`\r[fal] Scene ${scene.scene_id}: in progress...`);
        }
      },
    }) as typeof result;
  }

  const videoUrl = result.data.video.url;
  console.log(`\n[fal] Scene ${scene.scene_id} complete. Downloading...`);

  await downloadFile(videoUrl, localPath);

  const stats = await fs.stat(localPath);
  if (stats.size === 0) {
    throw new Error(`Scene ${scene.scene_id}: downloaded clip is 0 bytes`);
  }

  return {
    scene_id: scene.scene_id,
    beat: scene.beat,
    shot_type: scene.shot_type,
    file_path: localPath,
    remote_url: videoUrl,
    duration_sec: scene.duration_sec,
  };
}

// ---------------------------------------------------------------------------
// DB stage log helpers
// ---------------------------------------------------------------------------

async function openStageLog(
  runId: number,
  adId: string,
  stage: string,
  params: object,
): Promise<number> {
  const res = await db.query(
    `INSERT INTO stage_logs (run_id, ad_id, stage, status, service, cost_usd, params)
     VALUES ($1, $2, $3, 'in_progress', 'fal_seedance', 0, $4)
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
// Public API — generate all content scenes in parallel
// ---------------------------------------------------------------------------

export async function generateAllVideoClips(
  script: ScriptJson,
  facts: FactsJson,
  runId: number,
  adId: string,
): Promise<VideoClipResult[]> {
  const creatorPhotoUrl = process.env.CREATOR_PHOTO_URL?.trim() || null;
  const contentScenes = script.video_script.scenes.filter((s) => s.beat !== 'cta');

  console.log(
    `[fal] Generating ${contentScenes.length} clips in parallel (creator photo: ${creatorPhotoUrl ? 'yes' : 'no'})`,
  );

  const results = await Promise.allSettled(
    contentScenes.map(async (scene) => {
      const stage = `video_gen_scene_${scene.scene_id}`;
      const logId = await openStageLog(runId, adId, stage, {
        scene_id: scene.scene_id,
        beat: scene.beat,
        shot_type: scene.shot_type,
        duration_sec: scene.duration_sec,
        endpoint: scene.shot_type === 'ugc_creator' ? 'reference-to-video' : 'image-to-video',
      });
      const t = Date.now();

      try {
        const clip = await generateClip(
          scene,
          script.video_script.global_style,
          facts,
          creatorPhotoUrl,
          adId,
        );
        const cost = scene.duration_sec * COST_PER_SEC;
        await closeStageLog(logId, Date.now() - t, cost, {
          file_path: clip.file_path,
          remote_url: clip.remote_url,
          duration_sec: clip.duration_sec,
        });
        return clip;
      } catch (firstErr) {
        // One retry per scene
        console.warn(
          `[fal] Scene ${scene.scene_id} failed (attempt 1): ${(firstErr as Error).message} — retrying`,
        );
        try {
          const clip = await generateClip(
            scene,
            script.video_script.global_style,
            facts,
            creatorPhotoUrl,
            adId,
          );
          const cost = scene.duration_sec * COST_PER_SEC;
          await closeStageLog(logId, Date.now() - t, cost, {
            file_path: clip.file_path,
            remote_url: clip.remote_url,
            duration_sec: clip.duration_sec,
            retried: true,
          });
          return clip;
        } catch (retryErr) {
          await failStageLog(logId, Date.now() - t, (retryErr as Error).message);
          throw retryErr;
        }
      }
    }),
  );

  const clips = results
    .filter((r): r is PromiseFulfilledResult<VideoClipResult> => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.warn(`[fal] ${failed.length}/${contentScenes.length} scenes failed`);
  }

  if (clips.length === 0) {
    throw new Error('All video generation calls failed — no clips produced');
  }

  // Update run total cost
  const totalCost = clips.reduce((sum, c) => sum + c.duration_sec * COST_PER_SEC, 0);
  await db.query('UPDATE runs SET total_cost_usd = total_cost_usd + $1 WHERE id = $2', [
    totalCost,
    runId,
  ]);

  return clips.sort((a, b) => a.scene_id - b.scene_id);
}
