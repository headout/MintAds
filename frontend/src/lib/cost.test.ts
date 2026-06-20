import { describe, it, expect } from 'vitest';
import { rollupCost } from './cost';
import type { CostStage } from './types';

function stage(stage: string, cost_usd: number): CostStage {
  return { stage, service: null, model: null, cost_usd };
}

describe('rollupCost', () => {
  it('rolls per-stage costs into Script / Video / Audio / Assembly buckets', () => {
    const { rows, total } = rollupCost([
      stage('content_ingestion', 0),
      stage('script_gen', 0.02),
      stage('script_validation', 0),
      stage('video_gen_scene_1', 0.97),
      stage('video_gen_scene_2', 1.2),
      stage('audio_gen_scene_1', 0.01),
      stage('assembly', 0),
      stage('export', 0),
    ]);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.cost]));
    expect(byLabel.Script).toBeCloseTo(0.02);
    expect(byLabel.Video).toBeCloseTo(2.17);
    expect(byLabel.Audio).toBeCloseTo(0.01);
    expect(byLabel.Assembly).toBeCloseTo(0);
    expect(total).toBeCloseTo(2.2);
  });

  it('always returns the four core buckets in a fixed order', () => {
    const { rows } = rollupCost([]);
    expect(rows.map((r) => r.label)).toEqual(['Script', 'Video', 'Audio', 'Assembly']);
  });
});
