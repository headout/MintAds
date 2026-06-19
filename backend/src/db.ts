import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// .env lives at project root, one level above backend/
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Postgres pool error:', err);
});

export const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
  end: () => pool.end(),
};
