import { describe, it, expect } from 'vitest';
import { buildTracker } from './tracker';
import type { StageLog } from './types';

function log(stage: string, status: StageLog['status'], extra: Partial<StageLog> = {}): StageLog {
  return {
    stage,
    status,
    service: null,
    cost_usd: 0,
    duration_ms: null,
    started_at: null,
    completed_at: null,
    ...extra,
  };
}

describe('buildTracker', () => {
  it('keeps the linear backbone order with pending placeholders for missing stages', () => {
    const items = buildTracker([log('content_ingestion', 'completed')]);
    const keys = items.map((i) => i.key);
    expect(keys).toEqual([
      'content_ingestion',
      'script_gen',
      'script_validation',
      'video',
      'audio',
      'assembly',
      'export',
    ]);
    const script = items.find((i) => i.key === 'script_gen')!;
    expect(script.kind).toBe('single');
    if (script.kind === 'single') expect(script.stage).toBeNull();
  });

  it('dedupes retried script stages, keeping the latest attempt', () => {
    const items = buildTracker([
      log('script_gen', 'completed', { cost_usd: 0.02 }),
      log('script_gen', 'in_progress', { cost_usd: 0.03 }),
    ]);
    const script = items.find((i) => i.key === 'script_gen')!;
    if (script.kind === 'single') {
      expect(script.stage?.status).toBe('in_progress');
      expect(script.stage?.cost_usd).toBe(0.03);
    }
  });

  it('groups video scenes sorted by scene number', () => {
    const items = buildTracker([
      log('video_gen_scene_2', 'in_progress'),
      log('video_gen_scene_1', 'completed'),
      log('video_gen_scene_10', 'pending'),
    ]);
    const video = items.find((i) => i.key === 'video')!;
    expect(video.kind).toBe('group');
    if (video.kind === 'group') {
      expect(video.children.map((c) => c.stage.stage)).toEqual([
        'video_gen_scene_1',
        'video_gen_scene_2',
        'video_gen_scene_10',
      ]);
      expect(video.children[0].label).toBe('Scene 1');
    }
  });

  it('groups audio scenes the same way', () => {
    const items = buildTracker([log('audio_gen_scene_3', 'completed')]);
    const audio = items.find((i) => i.key === 'audio')!;
    if (audio.kind === 'group') {
      expect(audio.children).toHaveLength(1);
      expect(audio.children[0].label).toBe('Scene 3');
    }
  });
});
