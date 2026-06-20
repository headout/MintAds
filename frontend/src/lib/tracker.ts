import type { StageLog } from './types';

export interface TrackerChild {
  label: string;
  stage: StageLog;
}

export type TrackerItem =
  | { kind: 'single'; key: string; label: string; stage: StageLog | null }
  | { kind: 'group'; key: string; label: string; children: TrackerChild[] };

const LINEAR: { key: string; label: string }[] = [
  { key: 'content_ingestion', label: 'Content ingestion' },
  { key: 'script_gen', label: 'Script generation' },
  { key: 'script_validation', label: 'Script validation' },
];

const TAIL: { key: string; label: string }[] = [
  { key: 'assembly', label: 'Assembly' },
  { key: 'export', label: 'Export' },
];

function sceneNumber(stage: string): number {
  const match = stage.match(/_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/** Last log wins (retried script_gen/script_validation overwrite earlier attempts). */
function latestByStage(stages: StageLog[]): Map<string, StageLog> {
  const map = new Map<string, StageLog>();
  for (const s of stages) map.set(s.stage, s);
  return map;
}

function sceneGroup(
  key: string,
  label: string,
  prefix: string,
  byStage: Map<string, StageLog>,
): Extract<TrackerItem, { kind: 'group' }> {
  const children: TrackerChild[] = [...byStage.values()]
    .filter((s) => s.stage.startsWith(prefix))
    .sort((a, b) => sceneNumber(a.stage) - sceneNumber(b.stage))
    .map((stage) => ({ label: `Scene ${sceneNumber(stage.stage)}`, stage }));
  return { kind: 'group', key, label, children };
}

/**
 * Shape raw stage_logs into a fixed tracker: a linear backbone (with pending
 * placeholders for stages not yet logged), then dynamic Video/Audio scene
 * groups, then the assembly/export tail.
 */
export function buildTracker(stages: StageLog[]): TrackerItem[] {
  const byStage = latestByStage(stages);

  const head: TrackerItem[] = LINEAR.map(({ key, label }) => ({
    kind: 'single',
    key,
    label,
    stage: byStage.get(key) ?? null,
  }));

  const video = sceneGroup('video', 'Video', 'video_gen_scene_', byStage);
  const audio = sceneGroup('audio', 'Audio', 'audio_gen_scene_', byStage);

  const tail: TrackerItem[] = TAIL.map(({ key, label }) => ({
    kind: 'single',
    key,
    label,
    stage: byStage.get(key) ?? null,
  }));

  return [...head, video, audio, ...tail];
}
