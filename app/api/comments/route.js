import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { COMMENT_SELECT, MAX_COMMENT, TARGETS, bigId, commentOut, loadComment, requireUser, targetExists } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/comments?type=match|article|review|post&id=123&sort=new|top|old
//     -> every comment (and reply) on that thing, with its author, like count and whether you liked / wrote it
// GET /api/comments?type=match&top=1&limit=3
//     -> the most-liked comments of that type across the whole site (home page)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get('type');
  if (!TARGETS.includes(type)) return fail(400, 'type must be match, article, review or post');
  try {
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    if (sp.get('top') === '1') {
      const limit = Math.min(Math.max(parseInt(sp.get('limit')) || 3, 1), 20);
      const { rows } = await query(`${COMMENT_SELECT} WHERE c.target_type = $2 AND c.parent_id IS NULL ORDER BY likes DESC, c.created_at DESC LIMIT ${limit}`, [meId, type]);
      return json({ comments: rows.map(r => commentOut(r, meId)) });
    }
    const id = bigId(sp.get('id')); if (!id) return fail(400, 'Need the id of the thing');
    const order = { top: 'likes DESC, c.created_at DESC', old: 'c.created_at ASC' }[sp.get('sort')] || 'c.created_at DESC';
    const { rows } = await query(`${COMMENT_SELECT} WHERE c.target_type = $2 AND c.target_id = $3 ORDER BY ${order} LIMIT 1000`, [meId, type, id]);
    return json({ comments: rows.map(r => commentOut(r, meId)) });
  } catch (err) { return dbError(err); }
}

// POST /api/comments   body { type, id, body, parentId? }   -> saves a new comment (or a reply when parentId is given)
export async function POST(req) {
  const g = await requireUser(req, 'Sign in to comment'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const type = b.type, id = bigId(b.id), text = String(b.body ?? '').trim();
  if (!TARGETS.includes(type) || !id) return fail(400, 'Need type (match, article, review, post) and id');
  if (!text) return fail(400, 'Write something first');
  if (text.length > MAX_COMMENT) return fail(400, `Comments are limited to ${MAX_COMMENT} characters`);
  try {
    if (!(await targetExists(type, id, g.me.user_id))) return fail(404, 'That ' + type + ' does not exist');
    let parent = null;
    if (b.parentId != null) {
      const pid = bigId(b.parentId); if (!pid) return fail(400, 'Bad parentId');
      const p = (await query('SELECT comment_id, parent_id, target_type, target_id FROM comments WHERE comment_id = $1', [pid])).rows[0];
      if (!p || p.target_type !== type || String(p.target_id) !== String(id)) return fail(400, 'You can only reply to a comment on the same page');
      parent = p.parent_id ?? p.comment_id;          // replies are one level deep: replying to a reply attaches to the top comment
    }
    const { rows } = await query(
      `INSERT INTO comments (user_id, target_type, target_id, parent_id, body) VALUES ($1, $2, $3, $4, $5) RETURNING comment_id`,
      [g.me.user_id, type, id, parent, text]);
    return json({ comment: await loadComment(rows[0].comment_id, g.me.user_id) }, 201);
  } catch (err) { return dbError(err); }
}
