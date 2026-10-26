import { query } from '@/lib/db';
import { LIKE_TARGETS, bigId, requireUser, targetExists } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST   /api/likes   body { type: 'article' | 'comment' | 'review' | 'post', id }   -> like it
// DELETE /api/likes   same body                                                      -> remove your like
// Both answer { liked, count } with the fresh total. (Liking a match is saved as user_matches kind 'liked'.)
async function parse(req) {
  const g = await requireUser(req, 'Sign in to like things'); if (g.res) return g;
  const b = await readBody(req), type = b?.type, id = bigId(b?.id);
  if (!LIKE_TARGETS.includes(type) || !id) return { res: fail(400, 'Need type (article, comment, review, post) and id') };
  return { me: g.me, type, id };
}
const count = async (type, id) => (await query('SELECT count(*)::int AS n FROM likes WHERE target_type = $1 AND target_id = $2', [type, id])).rows[0].n;

export async function POST(req) {
  const p = await parse(req); if (p.res) return p.res;
  try {
    if (!(await targetExists(p.type, p.id, p.me.user_id))) return fail(404, 'That ' + p.type + ' does not exist');
    await query('INSERT INTO likes (user_id, target_type, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [p.me.user_id, p.type, p.id]);
    return json({ liked: true, count: await count(p.type, p.id) });
  } catch (err) { return dbError(err); }
}

export async function DELETE(req) {
  const p = await parse(req); if (p.res) return p.res;
  try {
    await query('DELETE FROM likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3', [p.me.user_id, p.type, p.id]);
    return json({ liked: false, count: await count(p.type, p.id) });
  } catch (err) { return dbError(err); }
}
