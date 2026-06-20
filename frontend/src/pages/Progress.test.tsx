import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { Progress } from './Progress';
import { api } from '../lib/api';
import type { StatusResponse } from '../lib/types';

function status(overrides: Partial<StatusResponse>): StatusResponse {
  return {
    ad_id: 'HDO_X',
    run_id: 1,
    status: 'generating',
    current_stage: 'video_gen + audio_gen',
    total_cost_usd: 2.88,
    error_message: null,
    created_at: '2026-06-20T12:00:00Z',
    completed_at: null,
    stages: [],
    ...overrides,
  };
}

function OutputProbe() {
  const { adId } = useParams();
  return <div data-testid="output">{adId}</div>;
}

function renderProgress() {
  return render(
    <MemoryRouter initialEntries={['/progress/HDO_X']}>
      <Routes>
        <Route path="/progress/:adId" element={<Progress />} />
        <Route path="/output/:adId" element={<OutputProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.restoreAllMocks());

describe('Progress page', () => {
  it('renders the stage tracker and the live running cost', async () => {
    vi.spyOn(api, 'getStatus').mockResolvedValue(
      status({
        stages: [
          { stage: 'content_ingestion', status: 'completed', service: 'headout', cost_usd: 0, duration_ms: 800, started_at: null, completed_at: null },
          { stage: 'video_gen_scene_1', status: 'in_progress', service: 'fal', cost_usd: 0, duration_ms: null, started_at: null, completed_at: null },
        ],
      }),
    );
    renderProgress();
    expect(await screen.findByText('Content ingestion')).toBeInTheDocument();
    expect(screen.getByText('Scene 1')).toBeInTheDocument();
    expect(screen.getByText('$2.88')).toBeInTheDocument();
  });

  it('shows a failure state with the backend error message', async () => {
    vi.spyOn(api, 'getStatus').mockResolvedValue(
      status({ status: 'failed', error_message: 'Headout 404: experience not found' }),
    );
    renderProgress();
    expect(await screen.findByText('Generation failed')).toBeInTheDocument();
    expect(screen.getByText('Headout 404: experience not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument();
  });

  it('navigates to the output view once completed', async () => {
    vi.spyOn(api, 'getStatus').mockResolvedValue(status({ status: 'completed' }));
    renderProgress();
    expect(await screen.findByTestId('output')).toHaveTextContent('HDO_X');
  });
});
