// Server-only: sessions, request checks and rate limiting for sign-up / sign-in.
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { query } from './db';

export const COOKIE = 'futlog_session';
const SESSION_DAYS = 30;
const sha = s => createHash('sha256').update(s).digest('hex');

/* ---------- sessions (a random token in an httpOnly cookie; only its hash is stored in the database) ---------- */
export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  await query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + $3 * interval '1 day')`, [sha(token), userId, SESSION_DAYS]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha(token)]);
  jar.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

// The signed-in user's row (without the password hash), or null.
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await query(
    `SELECT u.user_id, u.handle, u.display_name, u.email, u.bio, u.location, u.avatar_url, u.banner_url, u.banner_hue,
            u.favourite_team_id, u.is_author, u.created_at, u.updated_at
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha(token)]);
  return rows[0] || null;
}

/* ---------- request checks ---------- */
// Cross-site request guard for every write: the browser sends Origin on POST/PUT/DELETE, and it must be this site.
export function checkOrigin(req) {
  const origin = req.headers.get('origin');
  if (origin) {
    let host = ''; try { host = new URL(origin).host; } catch { /* invalid */ }
    const mine = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (host !== mine) return Response.json({ error: 'Cross-site request blocked' }, { status: 403 });
  }
  return null;
}

export const clientIp = req => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

/* ---------- brute-force protection: failed sign-ins are counted per account name and per IP ---------- */
const WINDOW_MIN = 15, MAX_FAILS = 8;
export async function tooManyAttempts(keys) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM auth_attempts WHERE key = ANY($1) AND at > now() - $2 * interval '1 minute' GROUP BY key ORDER BY n DESC LIMIT 1`, [keys, WINDOW_MIN]);
  return (rows[0]?.n || 0) >= MAX_FAILS;
}
export const recordFailure = keys => query(`INSERT INTO auth_attempts (key) SELECT unnest($1::text[])`, [keys]);
export const clearFailures = key => query('DELETE FROM auth_attempts WHERE key = $1', [key]);

/* ---------- input rules ---------- */
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export const PASSWORD_MIN = 8, PASSWORD_MAX = 128;
