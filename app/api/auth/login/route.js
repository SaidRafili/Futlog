import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/password.mjs';
import { checkOrigin, clearFailures, clientIp, recordFailure, tooManyAttempts } from '@/lib/auth';
import { startChallenge, maskEmail } from '@/lib/otp';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/auth/login   body { id, password }   (id = email or username)
// Step 1 of 2: checks the password, then e-mails a 6-digit code. The session is created by POST /api/auth/verify.
// -> { step: 'verify', challenge, email }
export async function POST(req) {
  const blocked = checkOrigin(req); if (blocked) return blocked;
  const b = await readBody(req);
  const id = String(b?.id ?? '').trim().toLowerCase().replace(/^@/, ''), password = String(b?.password ?? '');
  if (!id || !password || id.length > 255 || password.length > 128) return fail(400, 'Enter your email or username and your password');

  const ip = clientIp(req);
  const keys = ['id:' + id, 'ip:' + ip];
  try {
    if (await tooManyAttempts(keys)) return fail(429, 'Too many failed attempts. Wait 15 minutes and try again.');
    const { rows } = await query(
      `SELECT * FROM users WHERE ${id.includes('@') ? 'lower(email)' : 'handle'} = $1`, [id]);
    const u = rows[0];
    const ok = await verifyPassword(password, u?.password_hash);   // runs the same work even if the account doesn't exist
    if (!u || !ok) { await recordFailure(keys); return fail(401, 'Incorrect email/username or password'); }
    if (!u.email) return fail(400, 'This account has no email address, so it cannot receive a verification code.');
    await clearFailures('id:' + id);

    const r = await startChallenge({ purpose: 'signin', email: u.email.toLowerCase(), userId: u.user_id, ip });
    if (r.error) return fail(r.status, r.error);
    return json({ step: 'verify', challenge: r.challenge, email: maskEmail(u.email) });
  } catch (err) { return dbError(err); }
}
