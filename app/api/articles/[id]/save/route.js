import { query } from '@/lib/db';
import { bigId, requireUser } from '@/lib/content';
import { dbError, fail, json } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST   /api/articles/:id/save  -> bookmark the article (shows under "Saved" on your profile)
// DELETE /api/articles/:id/save  -> remove the bookmark
export async function POST(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such article');
  const g = await requireUser(req, 'Sign in to save articles'); if (g.res) return g.res;
  try {
    const r = await query(
      `INSERT INTO article_saves (user_id, article_id) SELECT $1, article_id FROM articles WHERE article_id = $2 AND status = 'published' ON CONFLICT DO NOTHING`, [g.me.user_id, id]);
    if (!r.rowCount && !(await query('SELECT 1 FROM article_saves WHERE user_id = $1 AND article_id = $2', [g.me.user_id, id])).rowCount) return fail(404, 'No such article');
    return json({ saved: true });
  } catch (err) { return dbError(err); }
}

export async function DELETE(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such article');
  const g = await requireUser(req); if (g.res) return g.res;
  try {
    await query('DELETE FROM article_saves WHERE user_id = $1 AND article_id = $2', [g.me.user_id, id]);
    return json({ saved: false });
  } catch (err) { return dbError(err); }
}
