import type {
  Angle,
  AngleHookMap,
  GenerateInput,
  GenerateResponse,
  Hook,
  ListRunsParams,
  OutputResponse,
  Persona,
  PersonaAngleMap,
  RunListItem,
  StatusResponse,
} from './types';

/** Empty base → relative URLs that ride the Vite dev proxy. Overridable for prod. */
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Thrown for any non-2xx response; carries the HTTP status and parsed body. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(0, 'Network error — is the backend running?', null);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body (e.g. empty) — leave body null.
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  getAngles: () => request<Angle[]>('/api/config/angles'),
  getHooks: () => request<Hook[]>('/api/config/hooks'),
  getPersonas: () => request<Persona[]>('/api/config/personas'),
  getAngleHookMap: () => request<AngleHookMap>('/api/config/angle-hook-map'),
  getPersonaAngleMap: () => request<PersonaAngleMap>('/api/config/persona-angle-map'),

  generate: (input: GenerateInput) =>
    request<GenerateResponse>('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),

  getStatus: (adId: string) =>
    request<StatusResponse>(`/api/status/${encodeURIComponent(adId)}`),

  getOutput: (adId: string) =>
    request<OutputResponse>(`/api/output/${encodeURIComponent(adId)}`),

  listRuns: (params: ListRunsParams = {}) =>
    request<RunListItem[]>(`/api/runs${buildQuery({ ...params })}`),
};
