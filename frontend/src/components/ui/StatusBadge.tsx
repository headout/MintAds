import styles from './StatusBadge.module.css';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusMeta {
  label: string;
  tone: Tone;
}

/** Humanize an unknown status key: "video_gen_scene_2" → "Video gen scene 2". */
function humanize(status: string): string {
  const spaced = status.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const META: Record<string, StatusMeta> = {
  // Run lifecycle
  pending: { label: 'Pending', tone: 'neutral' },
  ingesting: { label: 'Ingesting', tone: 'info' },
  scripting: { label: 'Scripting', tone: 'info' },
  generating: { label: 'Generating', tone: 'info' },
  assembling: { label: 'Assembling', tone: 'info' },
  exporting: { label: 'Exporting', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  // Stage status
  in_progress: { label: 'In progress', tone: 'info' },
};

export function statusMeta(status: string): StatusMeta {
  return META[status] ?? { label: humanize(status), tone: 'neutral' };
}

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, tone } = statusMeta(status);
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className ?? ''}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
