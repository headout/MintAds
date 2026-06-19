import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { Generate } from './Generate';
import { api } from '../lib/api';

function ProgressProbe() {
  const { adId } = useParams();
  return <div data-testid="progress">{adId}</div>;
}

function renderGenerate() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Generate />} />
        <Route path="/progress/:adId" element={<ProgressProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'getAngles').mockResolvedValue([
    { id: 'A3', name: 'Skip-the-Line', description: '', example_line: '', sub_format: null, journey: null, brand_lean: null },
    { id: 'A1', name: 'Iconic Moment', description: '', example_line: '', sub_format: null, journey: null, brand_lean: null },
  ]);
  vi.spyOn(api, 'getHooks').mockResolvedValue([
    { id: 'problem', name: 'Problem', template: '', description: '' },
    { id: 'fomo', name: 'FOMO', template: '', description: '' },
  ]);
  vi.spyOn(api, 'getPersonas').mockResolvedValue([
    { id: 'solo', name: 'Solo Traveller', description: '' },
  ]);
  vi.spyOn(api, 'getAngleHookMap').mockResolvedValue({ A3: { recommended: ['problem'], works: ['fomo'] } });
  vi.spyOn(api, 'getPersonaAngleMap').mockResolvedValue({ solo: { recommended: ['A3'], works: ['A1'] } });
  vi.spyOn(api, 'generate').mockResolvedValue({ ad_id: 'HDO_X', run_id: 1 });
});

describe('Generate page', () => {
  it('renders the form once config has loaded', async () => {
    renderGenerate();
    expect(await screen.findByLabelText(/experience id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate ad/i })).toBeInTheDocument();
  });

  it('blocks submission and flags required fields when empty', async () => {
    renderGenerate();
    await screen.findByLabelText(/experience id/i);
    await userEvent.click(screen.getByRole('button', { name: /generate ad/i }));
    expect(api.generate).not.toHaveBeenCalled();
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(4);
  });

  it('submits the payload and navigates to the progress route', async () => {
    renderGenerate();
    await screen.findByLabelText(/experience id/i);

    await userEvent.type(screen.getByLabelText(/experience id/i), '7148');
    await userEvent.selectOptions(screen.getByLabelText(/persona/i), 'solo');
    await userEvent.selectOptions(screen.getByLabelText(/angle/i), 'A3');
    await userEvent.selectOptions(screen.getByLabelText(/hook/i), 'problem');
    await userEvent.click(screen.getByRole('button', { name: /generate ad/i }));

    await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1));
    expect(api.generate).toHaveBeenCalledWith({
      experience_id: '7148',
      persona: 'solo',
      journey_type: 'pre_trip',
      brand: 'headout',
      angle: 'A3',
      hook: 'problem',
      video_format: '9:16',
      additional_details: undefined,
    });
    expect(await screen.findByTestId('progress')).toHaveTextContent('HDO_X');
  });
});
