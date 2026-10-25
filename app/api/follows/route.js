import { query } from '@/lib/db';
import { ME_HANDLE } from '@/lib/util';
import { cleanHandle, dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST   /api/follows   body { handle }  -> the current user follows @handle
// DELETE /api/follows   body { handle }  -> unfollows
async function parse(req) {
  const b = await readBody(req);
  const target = cleanHandle(b?.handle);
  if (!target) return { res: fail(400, 'Need the handle of the user') };
  if (target === ME_HANDLE) return { res: fail(400, 'You cannot follow yourself') };
  return { target };
}

export async function POST(req) {
  const p = await parse(req); if (p.res) return p.res;
  try {
    const r = await query(
      `INSERT INTO follows (follower_id, followee_id)
       SELECT me.user_id, them.user_id FROM users me, users them WHERE me.handle = $1 AND them.handle = $2 ON CONFLICT DO NOTHING`, [ME_HANDLE, p.target]);
    if (!r.rowCount) {
      const ok = await query('SELECT count(*)::int AS n FROM users WHERE handle IN ($1, $2)', [ME_HANDLE, p.target]);
      if (ok.rows[0].n < 2) return fail(404, 'Both users need a profile row before one can follow the other');
    }
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}

export async function DELETE(req) {
  const p = await parse(req); if (p.res) return p.res;
  try {
    await query(`DELETE FROM follows WHERE follower_id = (SELECT user_id FROM users WHERE handle = $1) AND followee_id = (SELECT user_id FROM users WHERE handle = $2)`, [ME_HANDLE, p.target]);
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}
