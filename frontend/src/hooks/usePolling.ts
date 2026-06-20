import { useEffect, useRef, useState } from 'react';

export interface UsePollingOptions<T> {
  intervalMs: number;
  /** Poll only while true. Defaults to true. */
  enabled?: boolean;
  /** Return true to stop polling (e.g. terminal status reached). */
  stopWhen?: (data: T) => boolean;
  /**
   * When this value changes, polling restarts (e.g. a new resource id after retry).
   * Needed because a terminal `stopWhen` stops the loop until deps change.
   */
  restartKey?: unknown;
}

export interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Polls `fetcher` immediately, then every `intervalMs`, until `stopWhen`
 * returns true or the component unmounts. Uses a self-scheduling timeout
 * (not setInterval) so requests never overlap, and tears down cleanly.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  { intervalMs, enabled = true, stopWhen, restartKey }: UsePollingOptions<T>,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest callbacks without restarting the poll loop on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const stopWhenRef = useRef(stopWhen);
  stopWhenRef.current = stopWhen;

  useEffect(() => {
    if (!enabled) return;

    setData(null);
    setError(null);

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const result = await fetcherRef.current();
        if (!active) return;
        setData(result);
        setError(null);
        if (stopWhenRef.current?.(result)) return; // terminal — do not reschedule
      } catch (err) {
        if (!active) return;
        setError(err as Error);
      }
      if (active) timer = setTimeout(tick, intervalMs);
    };

    void tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs, restartKey]);

  return { data, error };
}
