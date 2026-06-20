import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { initRemotionBundle } from './services/remotion-client';
import { errorHandler } from './middleware';
import generateRouter from './routes/generate';
import statusRouter from './routes/status';
import outputRouter from './routes/output';
import configRouter from './routes/config';
import runsRouter from './routes/runs';

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data/runs directory exists (gitignored, so not in repo)
const DATA_DIR = path.resolve(__dirname, '../../data/runs');
fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// Serve generated media files
app.use('/data', express.static(path.resolve(__dirname, '../../data')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Routes
app.use('/api', generateRouter);
app.use('/api', statusRouter);
app.use('/api', outputRouter);
app.use('/api', configRouter);
app.use('/api', runsRouter);

// Error-handling middleware — must be registered last, after all routes.
// Catches errors forwarded by asyncHandler so a failing DB/3rd-party call
// returns a JSON 500 instead of crashing the process.
app.use(errorHandler);

// Last-resort safety net: log async failures that escaped a handler instead of
// letting the default behavior tear the process down silently.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

app.listen(PORT, () => {
  console.log(`MintAds backend running on http://localhost:${PORT}`);
  // Bundle Remotion after server is up — takes ~30–60s, non-blocking
  initRemotionBundle().catch(err => {
    console.error('[remotion] Bundle failed — assembly will be unavailable:', err.message);
  });
});
