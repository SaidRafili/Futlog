import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { COMMENT_SELECT, POST_SELECT, commentOut, postOut } from '@/lib/content';
import { cleanHandle, dbError, fail, findUser, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 200;

// GET /api/users/:handle/written?type=post|comment
//   -> the feed posts / comments that this user WROTE themselves, newest first.
// (What a user liked is /api/users/:handle/likes.) `liked` / `likes` are from the point of view of the person asking.
export async function GET(req, { params }) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return fail(404, 'No such user');
  const type = new URL(req.url).searchParams.get('type');
  if (!['post', 'comment'].includes(type)) return fail(400, 'type must be post or comment');
  try {
    const u = await findUser(handle);
    if (!u) return fail(404, 'No such user');
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    // $1 = the viewer (used by the *_SELECT queries), $2 = the author
    if (type === 'post') {
      const { rows } = await query(`${POST_SELECT} WHERE p.user_id = $2::bigint ORDER BY p.created_at DESC LIMIT ${LIMIT}`, [meId, u.user_id]);
      return json({ posts: rows.map(r => postOut(r, meId)) });
    }
    const { rows } = await query(`${COMMENT_SELECT} WHERE c.user_id = $2::bigint ORDER BY c.created_at DESC LIMIT ${LIMIT}`, [meId, u.user_id]);
    return json({ comments: rows.map(r => commentOut(r, meId)) });
  } catch (err) { return dbError(err); }
}
