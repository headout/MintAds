import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('renders the app shell nav with New ad and History links', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /new ad/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /history/i })).toBeInTheDocument();
  });

  it('renders the Generate page at the index route', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { name: /create a new ad/i }),
    ).toBeInTheDocument();
  });

  it('renders the History page at /history', () => {
    renderAt('/history');
    expect(screen.getByRole('heading', { name: /^history$/i })).toBeInTheDocument();
  });

  it('renders a Progress placeholder at /progress/:adId', () => {
    renderAt('/progress/HDO_META_Test_A3_problem_UGC_EN_v01');
    expect(screen.getByTestId('progress-page')).toBeInTheDocument();
  });
});
