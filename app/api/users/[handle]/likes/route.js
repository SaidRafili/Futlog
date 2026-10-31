import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { ARTICLE_SELECT, COMMENT_SELECT, POST_SELECT, articleOut, commentOut, postOut } from '@/lib/content';
import { cleanHandle, dbError, fail, findUser, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 200;

// GET /api/users/:handle/likes?type=post|comment|article
//   -> what that user liked on the site (posts, comments or articles), most recently liked first.
// The `liked` / `likes` fields in the answer are from the point of view of the person asking.
export async function GET(req, { params }) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return fail(404, 'No such user');
  const type = new URL(req.url).searchParams.get('type');
  if (!['post', 'comment', 'article'].includes(type)) return fail(400, 'type must be post, comment or article');
  try {
    const u = await findUser(handle);
    if (!u) return fail(404, 'No such user');
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    // $1 = the viewer (used by the *_SELECT queries), $2 = the user whose likes are listed
    const mine = id => `JOIN likes lk ON lk.target_type = '${type}' AND lk.target_id = ${id} AND lk.user_id = $2::bigint`;
    if (type === 'post') {
      const { rows } = await query(`${POST_SELECT} ${mine('p.post_id')} ORDER BY lk.created_at DESC LIMIT ${LIMIT}`, [meId, u.user_id]);
      return json({ posts: rows.map(r => postOut(r, meId)) });
    }
    if (type === 'comment') {
      const { rows } = await query(`${COMMENT_SELECT} ${mine('c.comment_id')} ORDER BY lk.created_at DESC LIMIT ${LIMIT}`, [meId, u.user_id]);
      return json({ comments: rows.map(r => commentOut(r, meId)) });
    }
    const { rows } = await query(`${ARTICLE_SELECT} ${mine('a.article_id')} WHERE a.status = 'published' ORDER BY lk.created_at DESC LIMIT ${LIMIT}`, [meId, u.user_id]);
    return json({ articles: rows.map(r => articleOut(r, meId)) });
  } catch (err) { return dbError(err); }
}
