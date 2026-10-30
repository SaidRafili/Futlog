import { query } from '@/lib/db';
import { hashPassword } from '@/lib/password.mjs';
import { EMAIL_RE, PASSWORD_MAX, PASSWORD_MIN, checkOrigin, createSession } from '@/lib/auth';
import { HANDLE_RE, dbError, fail, json, liteFor, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/auth/signup   body { name, handle, email, password }  -> creates the account and signs it in
export async function POST(req) {
  const blocked = checkOrigin(req); if (blocked) return blocked;
  const b = await readBody(req);
  if (!b) return fail(400, 'Send a JSON body');

  const name = String(b.name ?? '').trim(), handle = String(b.handle ?? '').trim().toLowerCase().replace(/^@/, '');
  const email = String(b.email ?? '').trim().toLowerCase(), password = String(b.password ?? '');
  const fields = {};
  if (!name || name.length > 100) fields.name = 'Enter your name (up to 100 characters)';
  if (!HANDLE_RE.test(handle)) fields.handle = 'Username: 3–30 characters, lowercase letters, numbers, dots and underscores';
  if (!EMAIL_RE.test(email) || email.length > 255) fields.email = 'Enter a valid email address';
  if (password.length < PASSWORD_MIN) fields.password = `Use at least ${PASSWORD_MIN} characters`;
  else if (password.length > PASSWORD_MAX) fields.password = `Use at most ${PASSWORD_MAX} characters`;
  if (Object.keys(fields).length) return fail(400, 'Please fix the highlighted fields', { fields });

  try {
    const hash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (handle, display_name, email, password_hash) VALUES ($1, $2, $3, $4)
       RETURNING user_id, handle, display_name, email, bio, location, avatar_url, banner_url, banner_hue, favourite_team_id, is_author, created_at, updated_at`,
      [handle, name, email, hash]);
    await createSession(rows[0].user_id);
    return json(await liteFor(rows[0]), 201);
  } catch (err) {
    if (err.code === '23505') {
      const which = /email/i.test(err.constraint || '') ? 'email' : 'handle';
      return fail(409, 'Please fix the highlighted fields', { fields: { [which]: which === 'email' ? 'That email already has an account. Try signing in.' : 'That username is taken' } });
    }
    return dbError(err);
  }
}
