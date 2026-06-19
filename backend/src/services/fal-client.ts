import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import https from 'https';
import http from 'http';
import { fal } from '@fal-ai/client';
import { db } from '../db';
import type {
  SceneJson,
  GlobalStyle,
  FactsJson,
  ScriptJson,
  VideoClipResult,
  VoSegmentResult,
} from '../types';

// ---------------------------------------------------------------------------
// Endpoints + costs
// ---------------------------------------------------------------------------

const ENDPOINT_REFERENCE = 'bytedance/seedance-2.0/fast/reference-to-video';
const ENDPOINT_IMAGE = 'bytedance/seedance-2.0/fast/image-to-video';

// $0.2419/sec regardless of endpoint
const COST_PER_SEC = 0.2419;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

fal.config({ credentials: process.env.FAL_KEY ?? '' });

const DATA_RUNS_DIR = path.resolve(__dirname, '../../../data/runs');

// ---------------------------------------------------------------------------
// Audio upload — lip-sync scenes need the VO file as a CDN URL for fal.ai
// ---------------------------------------------------------------------------

async function uploadAudioToFal(localPath: string): Promise<string> {
  const buffer = await fs.readFile(localPath);
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  console.log(`[fal] Uploading VO segment to fal storage: ${path.basename(localPath)}`);
  const url = await fal.storage.upload(blob);
  console.log(`[fal] Audio upload complete → ${url}`);
  return url;
}

// ---------------------------------------------------------------------------
// Prompt builders — one per routing path
// ---------------------------------------------------------------------------

/**
 * ugc_creator + lip_sync:true — creator speaks to camera, mouth synced to @Audio1.
 */
function buildLipSyncCreatorPrompt(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  imageUrls: string[],
  hasCreatorPhoto: boolean,
): string {
  const lines: string[] = [];

  if (hasCreatorPhoto) {
    lines.push(
      `@Image1 is the creator — maintain their exact appearance (face, hair, outfit, body type) throughout.`,
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
  lines.push(
    `@Audio1 is the creator's voiceover — lip-sync the creator's mouth to this audio exactly.`,
  );
  lines.push('');
  lines.push(`${globalStyle.aesthetic}.`);
  lines.push(`Creator: ${globalStyle.creator_description}.`);
  lines.push(`Location: ${facts.city} — ${facts.title}.`);
  lines.push(`Creator speaks directly to camera. Lip movements MUST match @Audio1.`);
  lines.push(
    'Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.',
  );
  lines.push(
    'All scenes share the same visual theme and color grade to cut together seamlessly.',
  );
  lines.push('---');
  lines.push(scene.visual_direction);
  return lines.join('\n');
}

/**
 * ugc_creator + lip_sync:false — creator present but reacting, not speaking.
 */
function buildReactionCreatorPrompt(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  imageUrls: string[],
  hasCreatorPhoto: boolean,
): string {
  const lines: string[] = [];

  if (hasCreatorPhoto) {
    lines.push(
      `@Image1 is the creator — maintain their exact appearance (face, hair, outfit, body type) throughout.`,
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
  lines.push(
    'Creator is visible but NOT speaking. Natural authentic reactions only — genuine awe, wonder, walking.',
  );
  lines.push(
    'No winking, no exaggerated gestures, no theatrical expressions. Real person, real moment.',
  );
  lines.push(
    'Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.',
  );
  lines.push(
    'All scenes share the same visual theme and color grade to cut together seamlessly.',
  );
  lines.push('---');
  lines.push(scene.visual_direction);
  return lines.join('\n');
}

/**
 * b_roll — reference-to-video with 1–2 venue photos.
 * Each photo gets a proper @ImageN reference since all URLs are actually passed.
 */
function buildBrollPrompt(
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
  lines.push('No person in frame. Cinematic footage only.');
  lines.push(
    'Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.',
  );
  lines.push(
    'All scenes share the same visual theme and color grade to cut together seamlessly.',
  );
  lines.push('---');
  lines.push(scene.visual_direction);
  return lines.join('\n');
}

/**
 * pov | experience_detail — image-to-video, single venue photo.
 */
function buildSingleShotPrompt(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  primaryIdx: number,
): string {
  const kw = facts.photos[primaryIdx]?.keyword ?? 'venue';
  const lines: string[] = [];
  lines.push(`@Image1 shows: ${kw}.`);
  lines.push('');
  lines.push(`${globalStyle.aesthetic}.`);
  lines.push(`Location: ${facts.city} — ${facts.title}.`);
  lines.push('No person in frame. Cinematic footage only.');
  lines.push(
    'Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.',
  );
  lines.push(
    'All scenes share the same visual theme and color grade to cut together seamlessly.',
  );
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
        const status = response.statusCode ?? 0;
        // Follow redirects (301/302/303/307/308)
        if (status >= 300 && status < 400 && response.headers.location) {
          file.close();
          downloadFile(response.headers.location, localPath).then(resolve).catch(reject);
          return;
        }
        if (status >= 400) {
          file.close();
          fs.unlink(localPath).catch(() => {});
          reject(new Error(`Download failed: HTTP ${status} for ${url}`));
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
  voSegmentPath?: string, // provided only for lip_sync: true scenes
): Promise<VideoClipResult> {
  const localPath = path.join(
    DATA_RUNS_DIR,
    adId,
    'clips',
    `clip_${String(scene.scene_id).padStart(3, '0')}.mp4`,
  );

  let result: { data: { video: { url: string } } };

  if (scene.shot_type === 'ugc_creator') {
    const hasCreator = Boolean(creatorPhotoUrl);
    const venueUrls = scene.photo_reference_indices
      .map((idx) => facts.photos[idx]?.url)
      .filter((u): u is string => Boolean(u));

    const imageUrls = hasCreator ? [creatorPhotoUrl!, ...venueUrls] : venueUrls;

    if (imageUrls.length === 0) {
      throw new Error(`Scene ${scene.scene_id}: no images available for ugc_creator scene`);
    }

    if (scene.lip_sync && voSegmentPath) {
      // Lip-sync path: upload VO audio, drive mouth movement with @Audio1
      const audioUrl = await uploadAudioToFal(voSegmentPath);
      const prompt = buildLipSyncCreatorPrompt(scene, globalStyle, facts, imageUrls, hasCreator);

      console.log(
        `[fal] Scene ${scene.scene_id} (ugc_creator, lip_sync) → reference-to-video | ${imageUrls.length} image(s) + audio | ${scene.duration_sec}s`,
      );

      try {
        result = await fal.subscribe(ENDPOINT_REFERENCE, {
          input: {
            prompt,
            image_urls: imageUrls,
            audio_urls: [audioUrl],
            resolution: '720p',
            duration: String(scene.duration_sec),
            aspect_ratio: '9:16',
            generate_audio: true, // Seedance needs this to drive lip-sync; embedded audio muted at assembly
            bitrate_mode: 'standard',
            end_user_id: 'mintads-headout',
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              process.stdout.write(`\r[fal] Scene ${scene.scene_id} (lip-sync): in progress...`);
            }
          },
        }) as typeof result;
      } catch (err) {
        // 403 = reference-to-video early-access gate; fall back to image-to-video
        if (is403(err)) {
          console.warn(
            `[fal] Scene ${scene.scene_id}: reference-to-video 403, falling back to image-to-video`,
          );
          return generateImageToVideoFallback(scene, globalStyle, facts, localPath, adId);
        }
        throw err;
      }
    } else {
      // Reaction path: creator visible, not speaking
      const prompt = buildReactionCreatorPrompt(scene, globalStyle, facts, imageUrls, hasCreator);

      console.log(
        `[fal] Scene ${scene.scene_id} (ugc_creator, reaction) → reference-to-video | ${imageUrls.length} image(s) | ${scene.duration_sec}s`,
      );

      try {
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
              process.stdout.write(`\r[fal] Scene ${scene.scene_id} (reaction): in progress...`);
            }
          },
        }) as typeof result;
      } catch (err) {
        if (is403(err)) {
          console.warn(
            `[fal] Scene ${scene.scene_id}: reference-to-video 403, falling back to image-to-video`,
          );
          return generateImageToVideoFallback(scene, globalStyle, facts, localPath, adId);
        }
        throw err;
      }
    }
  } else if (scene.shot_type === 'b_roll') {
    // b_roll → reference-to-video with 1–2 venue photos.
    // Passing both as proper @ImageN references gives the model two complementary
    // angles to synthesize from, producing richer footage than a single input.
    const venueUrls = scene.photo_reference_indices
      .map((idx) => facts.photos[idx]?.url)
      .filter((u): u is string => Boolean(u));

    if (venueUrls.length === 0) {
      throw new Error(`Scene ${scene.scene_id}: no venue photos available for b_roll`);
    }

    const prompt = buildBrollPrompt(scene, globalStyle, facts, venueUrls);

    console.log(
      `[fal] Scene ${scene.scene_id} (b_roll) → reference-to-video | ${venueUrls.length} image(s) | ${scene.duration_sec}s`,
    );

    try {
      result = await fal.subscribe(ENDPOINT_REFERENCE, {
        input: {
          prompt,
          image_urls: venueUrls,
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
            process.stdout.write(`\r[fal] Scene ${scene.scene_id} (b_roll): in progress...`);
          }
        },
      }) as typeof result;
    } catch (err) {
      if (is403(err)) {
        console.warn(
          `[fal] Scene ${scene.scene_id}: reference-to-video 403, falling back to image-to-video`,
        );
        return generateImageToVideoFallback(scene, globalStyle, facts, localPath, adId);
      }
      throw err;
    }
  } else {
    // pov | experience_detail → image-to-video, single venue photo.
    // Single strong reference; no multi-angle benefit for these shot types.
    const primaryIdx = scene.photo_reference_indices[0] ?? 0;
    const imageUrl = facts.photos[primaryIdx]?.url ?? facts.photos[0]?.url;

    if (!imageUrl) {
      throw new Error(`Scene ${scene.scene_id}: no venue photo available`);
    }

    const prompt = buildSingleShotPrompt(scene, globalStyle, facts, primaryIdx);

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

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error(`Scene ${scene.scene_id}: fal.ai returned no video URL`);
  }
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

/**
 * Fallback when reference-to-video returns 403 (early-access gate).
 * Retries with image-to-video using the first venue photo.
 * For ugc_creator scenes the creator description stays in the prompt (prompt-only consistency).
 * For other shot types the cinematic prompt is already appropriate.
 */
async function generateImageToVideoFallback(
  scene: SceneJson,
  globalStyle: GlobalStyle,
  facts: FactsJson,
  localPath: string,
  adId: string,
): Promise<VideoClipResult> {
  const primaryIdx = scene.photo_reference_indices[0] ?? 0;
  const imageUrl = facts.photos[primaryIdx]?.url ?? facts.photos[0]?.url;
  if (!imageUrl) throw new Error(`Scene ${scene.scene_id}: no venue photo for fallback`);

  // ugc_creator scenes retain the creator in the prompt for prompt-only consistency;
  // cinematic prompt would actively suppress the creator which contradicts the beat intent.
  let prompt: string;
  if (scene.shot_type === 'ugc_creator') {
    const kw = facts.photos[primaryIdx]?.keyword ?? 'venue';
    prompt = [
      `@Image1 shows: ${kw}.`,
      '',
      `${globalStyle.aesthetic}.`,
      `Creator: ${globalStyle.creator_description}.`,
      `Location: ${facts.city} — ${facts.title}.`,
      'Creator is visible but NOT speaking. Natural authentic reactions only — genuine awe, wonder, walking.',
      'Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.',
      'All scenes share the same visual theme and color grade to cut together seamlessly.',
      '---',
      scene.visual_direction,
    ].join('\n');
  } else {
    prompt = buildSingleShotPrompt(scene, globalStyle, facts, primaryIdx);
  }

  const result = await fal.subscribe(ENDPOINT_IMAGE, {
    input: {
      prompt,
      image_url: imageUrl,
      resolution: '720p',
      duration: String(scene.duration_sec),
      aspect_ratio: '9:16',
      generate_audio: false,
      bitrate_mode: 'standard',
    },
    logs: false,
  }) as { data: { video: { url: string } } };

  await downloadFile(result.data.video.url, localPath);

  const stats = await fs.stat(localPath);
  if (stats.size === 0) throw new Error(`Scene ${scene.scene_id}: fallback clip is 0 bytes`);

  return {
    scene_id: scene.scene_id,
    beat: scene.beat,
    shot_type: scene.shot_type,
    file_path: localPath,
    remote_url: result.data.video.url,
    duration_sec: scene.duration_sec,
  };
}

function is403(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('403') || msg.toLowerCase().includes('forbidden');
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate video clips for a given set of scenes in parallel.
 *
 * Used by the orchestrator in two waves:
 *  - Wave 1: non-lip-sync scenes (voSegments omitted) — runs parallel with audio gen
 *  - Wave 2: lip-sync scenes (voSegments provided) — runs after audio gen completes
 *
 * @param scenes  The scenes to generate (pre-filtered: non-cta, and either lip_sync or not)
 * @param script  Full script (for global_style)
 * @param facts   Experience facts (for photo URLs + metadata)
 * @param runId   DB run ID for stage logging
 * @param adId    Ad ID string for filesystem paths + stage logging
 * @param voSegments  Optional VO segment results keyed by scene_id — required for lip-sync scenes
 */
export async function generateVideoClips(
  scenes: SceneJson[],
  script: ScriptJson,
  facts: FactsJson,
  runId: number,
  adId: string,
  voSegments?: VoSegmentResult[],
): Promise<VideoClipResult[]> {
  const creatorPhotoUrl = process.env.CREATOR_PHOTO_URL?.trim() || null;
  const voMap = new Map((voSegments ?? []).map((v) => [v.scene_id, v]));

  const results = await Promise.allSettled(
    scenes.map(async (scene) => {
      const stage = `video_gen_scene_${scene.scene_id}`;
      const logId = await openStageLog(runId, adId, stage, {
        scene_id: scene.scene_id,
        beat: scene.beat,
        shot_type: scene.shot_type,
        lip_sync: scene.lip_sync,
        duration_sec: scene.duration_sec,
        endpoint: (scene.shot_type === 'ugc_creator' || scene.shot_type === 'b_roll') ? 'reference-to-video' : 'image-to-video',
      });
      const t = Date.now();

      const voSegmentPath = scene.lip_sync ? voMap.get(scene.scene_id)?.file_path : undefined;

      const attempt = async () =>
        generateClip(
          scene,
          script.video_script.global_style,
          facts,
          creatorPhotoUrl,
          adId,
          voSegmentPath,
        );

      try {
        const clip = await attempt();
        const cost = scene.duration_sec * COST_PER_SEC;
        await closeStageLog(logId, Date.now() - t, cost, {
          file_path: clip.file_path,
          remote_url: clip.remote_url,
          duration_sec: clip.duration_sec,
        });
        return clip;
      } catch (firstErr) {
        console.warn(
          `[fal] Scene ${scene.scene_id} failed (attempt 1): ${(firstErr as Error).message} — retrying`,
        );
        try {
          const clip = await attempt();
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
    console.warn(`[fal] ${failed.length}/${scenes.length} scenes failed`);
  }

  if (clips.length === 0) {
    throw new Error('All video generation calls failed — no clips produced');
  }

  // Accumulate cost on the run record
  const totalCost = clips.reduce((sum, c) => sum + c.duration_sec * COST_PER_SEC, 0);
  await db.query('UPDATE runs SET total_cost_usd = total_cost_usd + $1 WHERE id = $2', [
    totalCost,
    runId,
  ]);

  return clips.sort((a, b) => a.scene_id - b.scene_id);
}

/**
 * Convenience wrapper: generate all non-cta scenes in a single parallel batch
 * WITHOUT lip-sync audio references. Suitable for non-lip-sync-only scripts or
 * test scripts. The orchestrator should use the two-wave generateVideoClips()
 * approach instead when lip_sync scenes are present.
 */
export async function generateAllVideoClips(
  script: ScriptJson,
  facts: FactsJson,
  runId: number,
  adId: string,
): Promise<VideoClipResult[]> {
  const contentScenes = script.video_script.scenes.filter((s) => s.beat !== 'cta');
  const creatorPhotoUrl = process.env.CREATOR_PHOTO_URL?.trim() || null;

  const lipSyncCount = contentScenes.filter((s) => s.lip_sync).length;
  if (lipSyncCount > 0) {
    console.warn(
      `[fal] generateAllVideoClips: ${lipSyncCount} lip_sync scene(s) will be generated WITHOUT audio — use generateVideoClips() with voSegments for proper lip-sync`,
    );
  }

  console.log(
    `[fal] Generating ${contentScenes.length} clips in parallel (creator photo: ${creatorPhotoUrl ? 'yes' : 'no'})`,
  );

  return generateVideoClips(contentScenes, script, facts, runId, adId);
}
