import { Pool } from 'pg';

// Reuse one pool across hot reloads in dev and across requests in prod
const globalForPg = globalThis;

export const pool =
  globalForPg.__pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.__pgPool = pool;

export const query = (text, params) => pool.query(text, params);
