const DASH = '—';

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/** Stage duration in ms → seconds with one decimal ("4.2s"). */
export function formatDurationMs(ms: number | null): string {
  if (ms == null) return DASH;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Whole-second run duration → "45s" or "1m 23s". */
export function formatDurationSec(sec: number | null): string {
  if (sec == null) return DASH;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

/** Coarse relative time, good enough for a run list. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  return new Date(iso).toLocaleDateString();
}
