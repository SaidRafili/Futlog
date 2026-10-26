import { query } from '@/lib/db';
import { checkOrigin, getSessionUser } from '@/lib/auth';
import { cleanHandle, dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST   /api/follows   body { handle }  -> the signed-in user follows @handle
// DELETE /api/follows   body { handle }  -> unfollows
async function parse(req) {
  const blocked = checkOrigin(req); if (blocked) return { res: blocked };
  const me = await getSessionUser();
  if (!me) return { res: fail(401, 'Sign in to follow people') };
  const b = await readBody(req);
  const target = cleanHandle(b?.handle);
  if (!target) return { res: fail(400, 'Need the handle of the user') };
  if (target === me.handle) return { res: fail(400, 'You cannot follow yourself') };
  return { me, target };
}

export async function POST(req) {
  const p = await parse(req); if (p.res) return p.res;
  try {
    const r = await query(
      `INSERT INTO follows (follower_id, followee_id) SELECT $1, user_id FROM users WHERE handle = $2 ON CONFLICT DO NOTHING`, [p.me.user_id, p.target]);
    if (!r.rowCount && !(await query('SELECT 1 FROM users WHERE handle = $1', [p.target])).rowCount) return fail(404, 'That user has no profile yet');
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}

export async function DELETE(req) {
  const p = await parse(req); if (p.res) return p.res;
  try {
    await query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = (SELECT user_id FROM users WHERE handle = $2)`, [p.me.user_id, p.target]);
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}
