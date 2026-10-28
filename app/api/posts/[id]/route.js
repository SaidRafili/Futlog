import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { MAX_POST, bigId, loadPost, requireUser } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/posts/:id  -> one post (the /post/:id page)
export async function GET(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such post');
  try {
    const me = await getSessionUser();
    const post = await loadPost(id, me?.user_id ?? null);
    return post ? json({ post }) : fail(404, 'No such post');
  } catch (err) { return dbError(err); }
}

// PUT /api/posts/:id   body { body }  -> edit the text of your own post (pictures stay as they are)
export async function PUT(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such post');
  const g = await requireUser(req, 'Sign in to edit your post'); if (g.res) return g.res;
  const b = await readBody(req); const text = String(b?.body ?? '').trim();
  if (text.length > MAX_POST) return fail(400, `Posts are limited to ${MAX_POST} characters`);
  try {
    if (!text && !(await query('SELECT 1 FROM post_images WHERE post_id = $1', [id])).rowCount) return fail(400, 'A post cannot be empty');
    const r = await query(`UPDATE posts SET body = $1::text, edited_at = CASE WHEN body <> $1::text THEN now() ELSE edited_at END WHERE post_id = $2 AND user_id = $3`, [text, id, g.me.user_id]);
    if (!r.rowCount) return fail(403, 'You can only edit your own posts');
    return json({ post: await loadPost(id, g.me.user_id) });
  } catch (err) { return dbError(err); }
}

// DELETE /api/posts/:id  -> delete your own post (pictures, replies and likes go with it)
export async function DELETE(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such post');
  const g = await requireUser(req); if (g.res) return g.res;
  try {
    const r = await query('DELETE FROM posts WHERE post_id = $1 AND user_id = $2', [id, g.me.user_id]);
    return r.rowCount ? json({ ok: true }) : fail(403, 'You can only delete your own posts');
  } catch (err) { return dbError(err); }
}
