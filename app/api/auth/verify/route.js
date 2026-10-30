import { query } from '@/lib/db';
import { checkOrigin, createSession } from '@/lib/auth';
import { consumeChallenge } from '@/lib/otp';
import { dbError, fail, json, liteFor, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const USER_COLS = `user_id, handle, display_name, email, bio, location, avatar_url, banner_url, banner_hue, favourite_team_id, is_author, created_at, updated_at`;

// POST /api/auth/verify   body { challenge, code }
// Step 2 of 2: with the right 6-digit code, creates the account (sign-up) or the session (sign-in).
export async function POST(req) {
  const blocked = checkOrigin(req); if (blocked) return blocked;
  const b = await readBody(req);
  const challenge = String(b?.challenge ?? ''), code = String(b?.code ?? '').replace(/\s+/g, '');
  if (!challenge || challenge.length > 100) return fail(400, 'Start again');
  if (!/^\d{6}$/.test(code)) return fail(400, 'Enter the 6-digit code from the email');

  try {
    const r = await consumeChallenge(challenge, code);
    if (r.error) return fail(r.status, r.error);
    const c = r.row;

    if (c.purpose === 'signup') {
      const { name, handle, password_hash } = c.payload || {};
      if (!name || !handle || !password_hash) return fail(400, 'Start again');
      try {
        const { rows } = await query(
          `INSERT INTO users (handle, display_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLS}`,
          [handle, name, c.email, password_hash]);
        await createSession(rows[0].user_id);
        return json(await liteFor(rows[0]), 201);
      } catch (err) {
        if (err.code === '23505') {   // someone took the email / username while the code was in the mail
          const email = /email/i.test(err.constraint || '');
          return fail(409, email ? 'That email already has an account. Try signing in.' : 'That username was just taken. Start again with another one.', { restart: true });
        }
        throw err;
      }
    }

    const { rows } = await query(`SELECT ${USER_COLS} FROM users WHERE user_id = $1`, [c.user_id]);
    if (!rows[0]) return fail(400, 'Start again');
    await createSession(rows[0].user_id);
    return json(await liteFor(rows[0]));
  } catch (err) { return dbError(err); }
}
