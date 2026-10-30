import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { COMMENT_SELECT, commentOut, withTargetTitles } from '@/lib/content';
import { cleanHandle, dbError, fail, findUser, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIMIT = 200;

// GET /api/users/:handle/comments
//   -> the comments and replies that user WROTE (on matches, articles, posts and reviews), newest first.
// (What a user liked is GET /api/users/:handle/likes?type=comment, and their feed posts are GET /api/posts?handle=...)
// The `liked` / `likes` fields in the answer are from the point of view of the person asking.
export async function GET(req, { params }) {
  const handle = cleanHandle((await params).handle);
  if (!handle) return fail(404, 'No such user');
  try {
    const u = await findUser(handle);
    if (!u) return fail(404, 'No such user');
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    const { rows } = await query(`${COMMENT_SELECT} WHERE c.user_id = $2::bigint ORDER BY c.created_at DESC LIMIT ${LIMIT}`, [meId, u.user_id]);
    return json({ comments: await withTargetTitles(rows.map(r => commentOut(r, meId))) });
  } catch (err) { return dbError(err); }
}
