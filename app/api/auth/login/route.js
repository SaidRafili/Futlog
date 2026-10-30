import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/password.mjs';
import { checkOrigin, clearFailures, clientIp, createSession, recordFailure, tooManyAttempts } from '@/lib/auth';
import { dbError, fail, json, liteFor, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/auth/login   body { id, password }   (id = email or username)
export async function POST(req) {
  const blocked = checkOrigin(req); if (blocked) return blocked;
  const b = await readBody(req);
  const id = String(b?.id ?? '').trim().toLowerCase().replace(/^@/, ''), password = String(b?.password ?? '');
  if (!id || !password || id.length > 255 || password.length > 128) return fail(400, 'Enter your email or username and your password');

  const keys = ['id:' + id, 'ip:' + clientIp(req)];
  try {
    if (await tooManyAttempts(keys)) return fail(429, 'Too many failed attempts. Wait 15 minutes and try again.');
    const { rows } = await query(
      `SELECT * FROM users WHERE ${id.includes('@') ? 'lower(email)' : 'handle'} = $1`, [id]);
    const u = rows[0];
    const ok = await verifyPassword(password, u?.password_hash);   // runs the same work even if the account doesn't exist
    if (!u || !ok) { await recordFailure(keys); return fail(401, 'Incorrect email/username or password'); }
    await clearFailures('id:' + id);
    await createSession(u.user_id);
    return json(await liteFor(u));
  } catch (err) { return dbError(err); }
}
