import path from 'path';

// Single source of truth for the data/runs directory.
// In production set DATA_DIR to a persistent volume mount (e.g. /data on Railway).
// In local dev leave DATA_DIR unset — falls back to the monorepo data/ directory.
export const DATA_RUNS_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, 'runs')
  : path.resolve(__dirname, '../../data/runs');
