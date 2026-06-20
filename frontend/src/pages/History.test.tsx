import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { History } from './History';
import { api } from '../lib/api';
import type { RunListItem } from '../lib/types';

function run(overrides: Partial<RunListItem>): RunListItem {
  return {
    ad_id: 'HDO_A',
    experience_id: '7148',
    angle: 'A3',
    hook: 'problem',
    persona: 'solo_travellers',
    video_format: '9:16',
    status: 'completed',
    total_cost_usd: 4.53,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_sec: 95,
    ...overrides,
  };
}

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.restoreAllMocks());

describe('History page', () => {
  it('lists runs with cost, duration and a status badge, linking by status', async () => {
    vi.spyOn(api, 'listRuns').mockResolvedValue([
      run({ ad_id: 'HDO_DONE', status: 'completed', total_cost_usd: 4.53, duration_sec: 95 }),
      run({ ad_id: 'HDO_RUN', status: 'generating', total_cost_usd: 0.05, duration_sec: null }),
    ]);
    renderHistory();

    const doneLink = await screen.findByRole('link', { name: 'HDO_DONE' });
    expect(doneLink).toHaveAttribute('href', '/output/HDO_DONE');
    const runningLink = screen.getByRole('link', { name: 'HDO_RUN' });
    expect(runningLink).toHaveAttribute('href', '/progress/HDO_RUN');

    expect(screen.getByText('$4.53')).toBeInTheDocument();
    expect(screen.getByText('1m 35s')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Completed')).toBeInTheDocument();
  });

  it('shows an empty state when there are no runs', async () => {
    vi.spyOn(api, 'listRuns').mockResolvedValue([]);
    renderHistory();
    expect(await screen.findByText('No runs yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create a new ad/i })).toBeInTheDocument();
  });
});
