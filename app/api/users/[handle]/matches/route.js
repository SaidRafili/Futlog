import { query } from '@/lib/db';
import { KINDS, cleanHandle, dbError, fail, isMe, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST   /api/users/:handle/matches   body { matchId, kind: 'watched' | 'liked' | 'onsite' }   -> adds it to the user's activity
// DELETE /api/users/:handle/matches   same body                                                -> removes it
async function parse(req, params) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return { res: fail(404, 'No such user') };
  if (!isMe(handle)) return { res: fail(403, 'You can only change your own activity') };
  const b = await readBody(req);
  const matchId = Number(b?.matchId);
  if (!Number.isInteger(matchId) || matchId <= 0 || !KINDS.includes(b?.kind)) return { res: fail(400, 'Need matchId and kind (watched, liked or onsite)') };
  return { handle, matchId, kind: b.kind };
}

export async function POST(req, { params }) {
  const p = await parse(req, params); if (p.res) return p.res;
  try {
    const r = await query(
      `INSERT INTO user_matches (user_id, match_id, kind) SELECT user_id, $2, $3 FROM users WHERE handle = $1 ON CONFLICT DO NOTHING`, [p.handle, p.matchId, p.kind]);
    if (!r.rowCount && !(await query('SELECT 1 FROM users WHERE handle = $1', [p.handle])).rowCount)
      return fail(404, 'Create your profile first: open Settings and save once');
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}

export async function DELETE(req, { params }) {
  const p = await parse(req, params); if (p.res) return p.res;
  try {
    await query(`DELETE FROM user_matches WHERE match_id = $2 AND kind = $3 AND user_id = (SELECT user_id FROM users WHERE handle = $1)`, [p.handle, p.matchId, p.kind]);
    return json({ ok: true });
  } catch (err) { return dbError(err); }
}
