import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { MAX_POST, POST_SELECT, posInt, postOut, requireUser } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/posts?tab=latest|top|following&matchId=123&limit=50
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get('limit')) || 50, 1), 100), tab = sp.get('tab') || 'latest';
  try {
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    const where = [], args = [meId];
    if (sp.get('matchId')) { const m = posInt(sp.get('matchId')); if (!m) return fail(400, 'Bad matchId'); args.push(m); where.push(`p.match_id = $${args.length}`); }
    if (tab === 'following') {
      if (!me) return json({ posts: [] });
      where.push(`p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1::bigint)`);
    }
    const order = tab === 'top' ? 'likes DESC, p.created_at DESC' : 'p.created_at DESC';
    const { rows } = await query(`${POST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`, args);
    return json({ posts: rows.map(r => postOut(r, meId)) });
  } catch (err) { return dbError(err); }
}

// POST /api/posts   body { body, matchId? }   -> a new feed post
export async function POST(req) {
  const g = await requireUser(req, 'Sign in to post'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const text = String(b.body ?? '').trim();
  if (!text) return fail(400, 'Write something first');
  if (text.length > MAX_POST) return fail(400, `Posts are limited to ${MAX_POST} characters`);
  const matchId = b.matchId ? posInt(b.matchId) : null;
  if (b.matchId && !matchId) return fail(400, 'Bad matchId');
  try {
    const { rows } = await query('INSERT INTO posts (user_id, body, match_id) VALUES ($1, $2, $3) RETURNING post_id', [g.me.user_id, text, matchId]);
    const r = (await query(`${POST_SELECT} WHERE p.post_id = $2`, [g.me.user_id, rows[0].post_id])).rows[0];
    return json({ post: postOut(r, g.me.user_id) }, 201);
  } catch (err) { return dbError(err); }
}
