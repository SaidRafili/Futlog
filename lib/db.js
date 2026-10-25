// PostgreSQL connection (server-side only – never import this from a 'use client' file).
import { Pool } from 'pg';
import { getPoolConfig } from './dbconfig.mjs';

// Reuse one pool across hot reloads in dev, otherwise every edit opens new connections.
const g = globalThis;

export const pool = g.__futlogPool ?? (g.__futlogPool = new Pool(getPoolConfig()));

export const query = (text, params) => pool.query(text, params);
