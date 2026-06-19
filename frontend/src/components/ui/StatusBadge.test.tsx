import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, statusMeta } from './StatusBadge';

describe('statusMeta', () => {
  it('maps terminal run statuses to success/danger tones', () => {
    expect(statusMeta('completed')).toMatchObject({ tone: 'success', label: 'Completed' });
    expect(statusMeta('failed')).toMatchObject({ tone: 'danger', label: 'Failed' });
  });

  it('maps in-flight statuses to the info tone', () => {
    expect(statusMeta('generating').tone).toBe('info');
    expect(statusMeta('in_progress')).toMatchObject({ tone: 'info', label: 'In progress' });
  });

  it('maps pending to a neutral tone', () => {
    expect(statusMeta('pending').tone).toBe('neutral');
  });

  it('falls back to a humanized label for unknown statuses', () => {
    expect(statusMeta('video_gen_scene_2').label).toBe('Video gen scene 2');
  });
});

describe('StatusBadge', () => {
  it('renders a text label (never color alone)', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
