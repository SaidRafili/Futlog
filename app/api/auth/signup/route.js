import { query } from '@/lib/db';
import { hashPassword } from '@/lib/password.mjs';
import { EMAIL_RE, PASSWORD_MAX, PASSWORD_MIN, checkOrigin, clientIp } from '@/lib/auth';
import { startChallenge, maskEmail } from '@/lib/otp';
import { HANDLE_RE, dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/auth/signup   body { name, handle, email, password }
// Step 1 of 2: validates the form and e-mails a 6-digit code. The account is created by POST /api/auth/verify.
// -> { step: 'verify', challenge, email }
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
    // Tell the person about a taken email / username now, before we send anything.
    const { rows } = await query('SELECT handle, lower(email) AS email FROM users WHERE handle = $1 OR lower(email) = $2', [handle, email]);
    if (rows.some(r => r.email === email)) fields.email = 'That email already has an account. Try signing in.';
    if (rows.some(r => r.handle === handle)) fields.handle = 'That username is taken';
    if (Object.keys(fields).length) return fail(409, 'Please fix the highlighted fields', { fields });

    const password_hash = await hashPassword(password);
    const r = await startChallenge({ purpose: 'signup', email, payload: { name, handle, password_hash }, ip: clientIp(req) });
    if (r.error) return fail(r.status, r.error);
    return json({ step: 'verify', challenge: r.challenge, email: maskEmail(email) });
  } catch (err) { return dbError(err); }
}
