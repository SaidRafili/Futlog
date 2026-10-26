// Usage:  npm run user:claim -- <username> <email> <password>
// Gives an existing user row (for example the seeded "saidrafili") an email + password so you can sign in as it.
// Only works for rows that have no password yet.
import pg from 'pg';
import { getPoolConfig } from '../lib/dbconfig.mjs';
import { hashPassword } from '../lib/password.mjs';

const [handle, email, password] = process.argv.slice(2);
if (!handle || !email || !password || password.length < 8) { console.error('Usage: npm run user:claim -- <username> <email> <password (8+ chars)>'); process.exit(1); }
const pool = new pg.Pool(getPoolConfig());
try {
  const hash = await hashPassword(password);
  const r = await pool.query(
    `UPDATE users SET email = lower($2), password_hash = $3 WHERE handle = $1 AND password_hash IS NULL RETURNING handle`, [handle.toLowerCase(), email, hash]);
  console.log(r.rowCount ? `@${handle} can now sign in with ${email.toLowerCase()}` : `No user "${handle}" without a password (it does not exist, or already has one)`);
  if (!r.rowCount) process.exitCode = 1;
} catch (e) { console.error('Failed: ' + e.message); process.exitCode = 1; }
finally { await pool.end(); }
