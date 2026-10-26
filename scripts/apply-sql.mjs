// Usage:  npm run db:schema          (runs scripts/schema.sql)
// Runs a .sql file against the "teams" database using the same connection settings as the app (no psql needed).
import fs from 'node:fs';
import pg from 'pg';
import { getPoolConfig } from '../lib/dbconfig.mjs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('Usage: node scripts/apply-sql.mjs path/to/file.sql'); process.exit(1); }
const pool = new pg.Pool(getPoolConfig());
try {
  await pool.query(fs.readFileSync(file, 'utf8'));
  console.log('Applied ' + file);
} catch (e) { console.error('Failed: ' + e.message); process.exitCode = 1; }
finally { await pool.end(); }
