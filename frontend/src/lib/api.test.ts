import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './api';

function mockFetchOnce(opts: { ok: boolean; status: number; body: unknown }) {
  const fn = vi.fn().mockResolvedValue({
    ok: opts.ok,
    status: opts.status,
    json: () => Promise.resolve(opts.body),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('api client', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed JSON on a 2xx response', async () => {
    mockFetchOnce({ ok: true, status: 200, body: [{ id: 'A1', name: 'Iconic' }] });
    const angles = await api.getAngles();
    expect(angles).toEqual([{ id: 'A1', name: 'Iconic' }]);
  });

  it('treats 202 (accepted) as success for generate', async () => {
    const fetchFn = mockFetchOnce({ ok: true, status: 202, body: { ad_id: 'HDO_X', run_id: 7 } });
    const res = await api.generate({
      experience_id: '7148',
      persona: 'solo',
      journey_type: 'pre_trip',
      brand: 'headout',
      angle: 'A3',
      hook: 'problem',
      video_format: '9:16',
    });
    expect(res).toEqual({ ad_id: 'HDO_X', run_id: 7 });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/generate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws ApiError carrying the backend error message on 400', async () => {
    mockFetchOnce({ ok: false, status: 400, body: { error: 'Missing required fields: angle' } });
    await expect(
      api.generate({
        experience_id: '',
        persona: 'solo',
        journey_type: 'pre_trip',
        brand: 'headout',
        angle: '',
        hook: 'problem',
        video_format: '9:16',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Missing required fields: angle',
    });
  });

  it('exposes the parsed body on the ApiError (e.g. 409 not-ready)', async () => {
    mockFetchOnce({
      ok: false,
      status: 409,
      body: { error: 'Run is not completed yet', status: 'generating' },
    });
    let caught: unknown;
    try {
      await api.getOutput('HDO_X');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
    expect((caught as ApiError).body).toMatchObject({ status: 'generating' });
  });

  it('builds the runs query string from params', async () => {
    const fetchFn = mockFetchOnce({ ok: true, status: 200, body: [] });
    await api.listRuns({ status: 'completed', limit: 10 });
    const calledUrl = fetchFn.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/runs?');
    expect(calledUrl).toContain('status=completed');
    expect(calledUrl).toContain('limit=10');
  });
});
