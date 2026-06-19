import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { Output } from './Output';
import { api, ApiError } from '../lib/api';
import type { OutputResponse } from '../lib/types';

function ProgressProbe() {
  const { adId } = useParams();
  return <div data-testid="progress">{adId}</div>;
}

function renderOutput() {
  return render(
    <MemoryRouter initialEntries={['/output/HDO_X']}>
      <Routes>
        <Route path="/output/:adId" element={<Output />} />
        <Route path="/progress/:adId" element={<ProgressProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const completed: OutputResponse = {
  ad_id: 'HDO_X',
  run_id: 1,
  experience_id: '7148',
  status: 'completed',
  completed_at: '2026-06-20T12:05:00Z',
  videos: [{ format: '9:16', url: '/data/runs/HDO_X/output/9x16.mp4', duration_sec: 32, file_size: 1000 }],
  cost_breakdown: {
    total: 2.2,
    by_service: {},
    by_stage: [
      { stage: 'script_gen', service: 'claude', model: null, cost_usd: 0.02 },
      { stage: 'video_gen_scene_1', service: 'fal', model: null, cost_usd: 2.17 },
      { stage: 'audio_gen_scene_1', service: 'elevenlabs', model: null, cost_usd: 0.01 },
      { stage: 'assembly', service: 'remotion', model: null, cost_usd: 0 },
    ],
  },
  claim_report: {
    claims: [
      { claim_text: '€68', source_field: 'price.display', verified: true },
      { claim_text: '4.6★', source_field: 'rating', verified: false },
    ],
    verified_claims: 1,
  },
  script: { metadata: { angle: 'A3', hook: 'problem' } },
  facts: { title: 'Colosseum' },
};

beforeEach(() => vi.restoreAllMocks());

describe('Output page', () => {
  it('renders the player, cost breakdown and claim report', async () => {
    vi.spyOn(api, 'getOutput').mockResolvedValue(completed);
    const { container } = renderOutput();

    expect(await screen.findByText('Cost breakdown')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$2.20')).toBeInTheDocument();
    expect(screen.getByText('Claim report')).toBeInTheDocument();
    expect(screen.getByText('1/2 claims verified')).toBeInTheDocument();

    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toContain('9x16.mp4');
  });

  it('redirects to the progress view when the run is not finished (409)', async () => {
    vi.spyOn(api, 'getOutput').mockRejectedValue(
      new ApiError(409, 'Run is not completed yet', { status: 'generating' }),
    );
    renderOutput();
    expect(await screen.findByTestId('progress')).toHaveTextContent('HDO_X');
  });
});
