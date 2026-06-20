import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePolling } from './usePolling';

describe('usePolling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fetches immediately and then stops once stopWhen is satisfied', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ status: 'generating' })
      .mockResolvedValueOnce({ status: 'completed' })
      .mockResolvedValue({ status: 'completed' });

    renderHook(() =>
      usePolling(fetcher, {
        intervalMs: 2000,
        stopWhen: (d: { status: string }) => d.status === 'completed',
      }),
    );

    // Immediate first tick → 'generating' → schedules another.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Second tick → 'completed' → must not schedule again.
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stops polling after unmount (no leaked timers)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'generating' });

    const { unmount } = renderHook(() => usePolling(fetcher, { intervalMs: 2000 }));

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not fetch when disabled', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 'generating' });
    renderHook(() => usePolling(fetcher, { intervalMs: 2000, enabled: false }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('restarts polling when restartKey changes after a terminal stop', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ id: 'old', status: 'failed' })
      .mockResolvedValueOnce({ id: 'new', status: 'generating' })
      .mockResolvedValue({ id: 'new', status: 'generating' });

    const { rerender } = renderHook(
      ({ restartKey }: { restartKey: string }) =>
        usePolling(fetcher, {
          intervalMs: 2000,
          restartKey,
          stopWhen: (d: { status: string }) => d.status === 'completed' || d.status === 'failed',
        }),
      { initialProps: { restartKey: 'old' } },
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ restartKey: 'new' });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
