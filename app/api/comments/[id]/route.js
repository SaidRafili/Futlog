import { query } from '@/lib/db';
import { MAX_COMMENT, bigId, loadComment, requireUser } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT /api/comments/:id   body { body }   -> edit your own comment (it is marked "edited")
export async function PUT(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such comment');
  const g = await requireUser(req, 'Sign in to edit your comment'); if (g.res) return g.res;
  const b = await readBody(req); const text = String(b?.body ?? '').trim();
  if (!text) return fail(400, 'A comment cannot be empty');
  if (text.length > MAX_COMMENT) return fail(400, `Comments are limited to ${MAX_COMMENT} characters`);
  try {
    const r = await query(
      `UPDATE comments SET body = $1, edited_at = CASE WHEN body <> $1 THEN now() ELSE edited_at END WHERE comment_id = $2 AND user_id = $3`, [text, id, g.me.user_id]);
    if (!r.rowCount) return fail(403, 'You can only edit your own comments');
    return json({ comment: await loadComment(id, g.me.user_id) });
  } catch (err) { return dbError(err); }
}

// DELETE /api/comments/:id   -> delete your own comment (its replies and likes go with it)
export async function DELETE(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such comment');
  const g = await requireUser(req); if (g.res) return g.res;
  try {
    const r = await query('DELETE FROM comments WHERE comment_id = $1 AND user_id = $2', [id, g.me.user_id]);
    return r.rowCount ? json({ ok: true }) : fail(403, 'You can only delete your own comments');
  } catch (err) { return dbError(err); }
}
