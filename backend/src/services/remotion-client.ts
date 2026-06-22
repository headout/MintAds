import path from 'path';
import fs from 'fs/promises';
import { createServer } from 'http';
import type { Server } from 'http';
import express from 'express';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { db } from '../db';
import type {
  VideoClipResult,
  VoSegmentResult,
  ScriptJson,
  UserInput,
  OutputFile,
  AssemblyResult,
  FactsJson,
} from '../types';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DATA_RUNS_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, 'runs')
  : path.resolve(__dirname, '../../../data/runs');
const REMOTION_DIR = path.resolve(__dirname, '../../../remotion');
const REMOTION_ENTRY = path.join(REMOTION_DIR, 'src/index.ts');

// ---------------------------------------------------------------------------
// Aspect ratio configs
// ---------------------------------------------------------------------------

const ASPECT_CONFIGS: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

// ---------------------------------------------------------------------------
// Bundle (initialized once at server startup, reused for all renders)
// ---------------------------------------------------------------------------

let bundleLocation: string | null = null;

export async function initRemotionBundle(): Promise<void> {
  console.log('[remotion] Bundling Remotion composition…');
  bundleLocation = await bundle({
    entryPoint: REMOTION_ENTRY,
    rootDir: REMOTION_DIR,
    onProgress: (p) => {
      if (p % 25 === 0) console.log(`[remotion] Bundle: ${p}%`);
    },
  });
  console.log('[remotion] Bundle ready:', bundleLocation);
}

// ---------------------------------------------------------------------------
// Temporary media HTTP server
//
// Remotion's compositor rejects file:// URLs — only http:// / https:// are
// accepted. We spin up a short-lived Express static server on a random port
// for the duration of each render, then shut it down when rendering is done.
// Files under DATA_RUNS_DIR are served at http://localhost:{port}/media/{rel}.
// ---------------------------------------------------------------------------

interface MediaServer {
  toUrl: (localPath: string) => string;
  close: () => Promise<void>;
}

async function startMediaServer(): Promise<MediaServer> {
  const app = express();
  app.use('/media', express.static(DATA_RUNS_DIR));

  const server: Server = createServer(app);

  return new Promise<MediaServer>((resolve, reject) => {
    server.listen(0, 'localhost', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('[remotion] Failed to get media server address'));
      }
      const baseUrl = `http://localhost:${addr.port}`;
      console.log(`[remotion] Media server up at ${baseUrl}/media/`);

      resolve({
        toUrl: (localPath: string) => {
          const rel = path.relative(DATA_RUNS_DIR, localPath).replace(/\\/g, '/');
          return `${baseUrl}/media/${rel}`;
        },
        close: () =>
          new Promise<void>((res, rej) =>
            server.close(err => (err ? rej(err) : res())),
          ),
      });
    });
    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// DB stage log helpers
// ---------------------------------------------------------------------------

async function openStageLog(runId: number, adId: string, params: object): Promise<number> {
  const res = await db.query(
    `INSERT INTO stage_logs (run_id, ad_id, stage, status, service, cost_usd, params)
     VALUES ($1, $2, 'assembly', 'in_progress', 'remotion', 0, $3)
     RETURNING id`,
    [runId, adId, JSON.stringify(params)],
  );
  return res.rows[0].id as number;
}

async function closeStageLog(logId: number, durationMs: number, result: object): Promise<void> {
  await db.query(
    `UPDATE stage_logs
     SET status='completed', completed_at=NOW(), duration_ms=$1, cost_usd=0, result=$2
     WHERE id=$3`,
    [durationMs, JSON.stringify(result), logId],
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
// assembleAd — called by the orchestrator after video + audio are complete
// ---------------------------------------------------------------------------

/**
 * Composite all clips + VO segments into final MP4 files via Remotion.
 *
 * Clips may be passed in any order — sorted by scene_id internally.
 * Starts a temporary HTTP server to serve local media files (Remotion's
 * compositor requires http:// URLs; file:// is not supported).
 * Renders once per requested aspect ratio (9:16 master + optional 1:1 / 16:9).
 * Assembly cost is $0.00 — self-hosted, CPU-only.
 */
export async function assembleAd(
  clips: VideoClipResult[],
  voSegments: VoSegmentResult[],
  script: ScriptJson,
  userInput: UserInput,
  runId: number,
  adId: string,
): Promise<AssemblyResult> {
  if (!bundleLocation) {
    throw new Error('Remotion bundle not initialized — call initRemotionBundle() at server startup.');
  }

  const fps = 30;
  const t = Date.now();

  const logId = await openStageLog(runId, adId, {
    clip_count: clips.length,
    vo_count: voSegments.length,
    video_format: userInput.video_format,
  });

  // Start media server — must stay alive for the full render duration
  const mediaServer = await startMediaServer();

  try {
    // Sort clips by scene_id — order drives cumulative frame offset calculation
    const sortedClips = [...clips].sort((a, b) => a.scene_id - b.scene_id);

    // Build sceneId → cumulative startSec map for text overlay timing
    let accSec = 0;
    const sceneStartSec = new Map<number, number>();
    for (const clip of sortedClips) {
      sceneStartSec.set(clip.scene_id, accSec);
      accSec += clip.duration_sec;
    }

    // Total frames: sum per-clip rounded frames to match the composition's own accumulation.
    // Rounding once over the total sum diverges from the composition by up to N frames.
    const contentFrames = sortedClips.reduce(
      (sum, c) => sum + Math.round(c.duration_sec * fps),
      0,
    );
    const endCardFrames = Math.round(4 * fps);
    const totalFrames = contentFrames + endCardFrames;
    const totalDurationSec = totalFrames / fps;

    // Text overlays anchored to actual clip timing (not script target durations)
    const textOverlays: Array<{
      text: string;
      keyword: string;
      keywordColor: string;
      position: 'top' | 'center' | 'bottom';
      startSec: number;
      durationSec: number;
    }> = [];
    for (const scene of script.video_script.scenes) {
      if (scene.beat === 'cta' || !scene.text_overlay) continue;
      const startSec = sceneStartSec.get(scene.scene_id);
      if (startSec === undefined) continue; // clip missing — skip overlay
      textOverlays.push({
        text: scene.text_overlay.text,
        keyword: scene.text_overlay.keyword,
        keywordColor: scene.text_overlay.keywordColor,
        position: scene.text_overlay.position,
        startSec,
        durationSec: scene.duration_sec,
      });
    }

    // Extract a ground-level photo and title from facts.json for the end card
    let experienceImageSrc: string | undefined;
    let experienceName: string | undefined;
    try {
      const normalizedRoot = path.resolve(DATA_RUNS_DIR);
      const factsPath = path.resolve(DATA_RUNS_DIR, adId, 'facts.json');
      if (!factsPath.startsWith(normalizedRoot + path.sep)) {
        throw new Error(`Unsafe facts.json path for adId: ${adId}`);
      }
      const factsRaw = JSON.parse(
        await fs.readFile(factsPath, 'utf-8'),
      ) as FactsJson;
      experienceName = factsRaw.short_title ?? factsRaw.title;
      const aerialPattern = /aerial|panoramic from top|overhead|bird'?s?\s*eye|from above|drone|view from|roman forum and palatine/i;
      const groundPhoto = factsRaw.photos.find(
        p => !aerialPattern.test(p.keyword) && !aerialPattern.test(p.alt),
      );
      if (groundPhoto) experienceImageSrc = groundPhoto.url;
    } catch {
      // non-fatal — end card renders without photo
    }

    // Build inputProps — shape must match AdProps in remotion/src/AdComposition.tsx
    const inputProps = {
      clips: sortedClips.map(c => {
        const scene = script.video_script.scenes.find(sc => sc.scene_id === c.scene_id);
        return {
          src: mediaServer.toUrl(c.file_path),
          durationSec: c.duration_sec,
          beat: c.beat,
          sceneId: c.scene_id,
          lipSync: scene?.lip_sync === true,
        };
      }),
      voSegments: [...voSegments]
        .sort((a, b) => a.scene_id - b.scene_id)
        .map(s => {
          const scene = script.video_script.scenes.find(sc => sc.scene_id === s.scene_id);
          return {
            sceneId: s.scene_id,
            filePath: mediaServer.toUrl(s.file_path),
            durationSec: s.duration_sec,
            lipSync: scene?.lip_sync === true,
          };
        }),
      textOverlays,
      bgMusicTheme: script.video_script.global_style.bg_music_theme ?? undefined,
      endCard: {
        priceDisplay: script.end_card.price_display,
        ratingDisplay: script.end_card.rating_display,
        reviewCountDisplay: script.end_card.review_count_display,
        ctaText: script.end_card.cta_text,
        brandLogo: script.end_card.brand_logo,
        cancellationText: script.end_card.cancellation_text ?? null,
        experienceImageSrc,
        experienceName,
      },
      fps,
    };

    // Determine which aspect ratios to render
    const formats = userInput.video_format === 'all'
      ? ['9:16', '1:1', '16:9']
      : [userInput.video_format];

    const outputDir = path.join(DATA_RUNS_DIR, adId, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Resolve composition once — all formats share the same inputProps and composition id
    const baseComposition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'AdComposition',
      inputProps,
    });

    const outputFiles: OutputFile[] = [];

    for (const format of formats) {
      const { width, height } = ASPECT_CONFIGS[format];
      const filename = `${format.replace(':', 'x')}.mp4`;
      const outputPath = path.join(outputDir, filename);

      console.log(`[remotion] Rendering ${format} (${width}×${height})…`);
      const tFmt = Date.now();

      await renderMedia({
        composition: {
          ...baseComposition,
          width,
          height,
          durationInFrames: totalFrames,
          fps,
        },
        serveUrl: bundleLocation,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          if (pct % 25 === 0) console.log(`[remotion] ${format}: ${pct}%`);
        },
      });

      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error(`Rendered ${format} output is 0 bytes — assembly failed`);
      }

      const elapsed = ((Date.now() - tFmt) / 1000).toFixed(1);
      const mb = (stats.size / 1024 / 1024).toFixed(1);
      console.log(`[remotion] ${format} done in ${elapsed}s — ${mb} MB → ${filename}`);

      outputFiles.push({
        format,
        file_path: outputPath,
        file_size: stats.size,
        duration_sec: totalDurationSec,
      });
    }

    await closeStageLog(logId, Date.now() - t, {
      formats_rendered: formats,
      output_files: outputFiles.length,
      total_duration_sec: totalDurationSec,
    });

    return { files: outputFiles };

  } catch (err) {
    await failStageLog(logId, Date.now() - t, (err as Error).message);
    throw err;

  } finally {
    await mediaServer.close();
  }
}
