// PostgreSQL connection (server-side only – never import this from a 'use client' file).
import { Pool } from 'pg';

// Reuse one pool across hot reloads in dev, otherwise every edit opens new connections.
const g = globalThis;

export const pool = g.__futlogPool ?? (g.__futlogPool = new Pool(
  process.env.DATABASE_URL
    // Neon: the URL already carries ?sslmode=require, which pg honours. Keep the pool small –
    // on Vercel every serverless instance gets its own pool, and Neon's -pooler host multiplexes them.
    ? { connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 }
    : {
        host: process.env.PGHOST || 'localhost',
        port: +(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'teams',
      }
));

export const query = (text, params) => pool.query(text, params);
