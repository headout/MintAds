import type { CostStage } from './types';

export interface CostRow {
  label: string;
  cost: number;
}

type Bucket = 'Script' | 'Video' | 'Audio' | 'Assembly';
const ORDER: Bucket[] = ['Script', 'Video', 'Audio', 'Assembly'];

function bucketFor(stage: string): Bucket | null {
  if (stage.startsWith('script_')) return 'Script';
  if (stage.startsWith('video_')) return 'Video';
  if (stage.startsWith('audio_')) return 'Audio';
  if (stage === 'assembly') return 'Assembly';
  return null; // content_ingestion / export — no spend worth surfacing
}

/** Collapse per-stage costs into the four buckets shown on the output view. */
export function rollupCost(byStage: CostStage[]): { rows: CostRow[]; total: number } {
  const sums: Record<Bucket, number> = { Script: 0, Video: 0, Audio: 0, Assembly: 0 };
  let total = 0;
  for (const s of byStage) {
    total += s.cost_usd;
    const bucket = bucketFor(s.stage);
    if (bucket) sums[bucket] += s.cost_usd;
  }
  return { rows: ORDER.map((label) => ({ label, cost: sums[label] })), total };
}
