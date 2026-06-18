import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

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

// Routes (wired in later chunks)
// app.use('/api', generateRouter);
// app.use('/api', statusRouter);
// app.use('/api', configRouter);
// app.use('/api', runsRouter);

app.listen(PORT, () => {
  console.log(`MintAds backend running on http://localhost:${PORT}`);
});
