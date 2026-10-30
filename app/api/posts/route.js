import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { MAX_POST, POST_SELECT, checkPostImages, loadPost, posInt, postOut, requireUser, withTx } from '@/lib/content';
import { cleanHandle, dbError, fail, json, readBody } from '@/lib/users';
import { parseSeed, pickRandom } from '@/lib/shuffle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/posts?tab=latest|top|following|mix&matchId=123&handle=alice&limit=50
//     tab=mix -> a weighted random sample of recent posts (liked / discussed / fresh posts come up more often, never the same author twice in a row).
//                Different on every request; pass &seed=123 to get the same mix again.
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get('limit')) || 50, 1), 100), tab = sp.get('tab') || 'latest';
  try {
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    const where = [], args = [meId];
    if (sp.get('matchId')) { const m = posInt(sp.get('matchId')); if (!m) return fail(400, 'Bad matchId'); args.push(m); where.push(`p.match_id = $${args.length}`); }
    if (sp.get('handle')) { const h = cleanHandle(sp.get('handle')); if (!h) return json({ posts: [] }); args.push(h); where.push(`u.handle = $${args.length}`); }
    if (tab === 'following') {
      if (!me) return json({ posts: [] });
      where.push(`p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1::bigint)`);
    }
    if (tab === 'mix') {                     // candidate pool = the newest 400 posts, then a weighted random sample of `limit`
      const { rows } = await query(`${POST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC LIMIT 400`, args);
      const seed = parseSeed(sp.get('seed'));
      const posts = pickRandom(rows.map(r => postOut(r, meId)), { seed, k: limit, halfLifeHours: 72 });
      return json({ posts, seed });
    }
    const order = tab === 'top' ? 'likes DESC, p.created_at DESC' : 'p.created_at DESC';
    const { rows } = await query(`${POST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`, args);
    return json({ posts: rows.map(r => postOut(r, meId)) });
  } catch (err) { return dbError(err); }
}

// POST /api/posts   body { body, matchId?, images?: [{ data, w, h, alt }] }   -> a new feed post (text, pictures, or both)
export async function POST(req) {
  const g = await requireUser(req, 'Sign in to post'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const text = String(b.body ?? '').trim();
  if (text.length > MAX_POST) return fail(400, `Posts are limited to ${MAX_POST} characters`);
  const pics = checkPostImages(b.images); if (pics.error) return fail(400, pics.error);
  if (!text && !pics.images.length) return fail(400, 'Write something or add a picture first');
  const matchId = b.matchId ? posInt(b.matchId) : null;
  if (b.matchId && !matchId) return fail(400, 'Bad matchId');
  try {
    const id = await withTx(async db => {
      const { rows } = await db.query('INSERT INTO posts (user_id, body, match_id) VALUES ($1, $2, $3) RETURNING post_id', [g.me.user_id, text, matchId]);
      const pid = rows[0].post_id;
      for (const [i, im] of pics.images.entries())
        await db.query('INSERT INTO post_images (post_id, position, mime, width, height, alt, data) VALUES ($1, $2, $3, $4, $5, $6, $7)', [pid, i, im.mime, im.w, im.h, im.alt, im.bytes]);
      return pid;
    });
    return json({ post: await loadPost(id, g.me.user_id) }, 201);
  } catch (err) { return dbError(err); }
}
