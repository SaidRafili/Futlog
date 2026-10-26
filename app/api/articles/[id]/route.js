import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { bigId, checkArticle, loadArticle, readMinutes, requireUser, withTx } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/articles/:id   the article with its body, matches, like count and whether you liked / saved it (drafts: author only)
export async function GET(_req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such article');
  try {
    const me = await getSessionUser();
    const a = await loadArticle(id, me?.user_id ?? null);
    return a ? json({ article: a }) : fail(404, 'No such article');
  } catch (err) { return dbError(err); }
}

// PUT /api/articles/:id   body: any of { title, category, body, cover, matchIds, status }   (author only)
// status 'published' publishes (the first time it sets the publish date), 'draft' takes it offline again.
export async function PUT(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such article');
  const g = await requireUser(req, 'Sign in to edit your article'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const c = checkArticle(b, { partial: true }); if (c.errors) return fail(400, 'Please fix the highlighted fields', { fields: c.errors });
  const v = c.value;
  try {
    const cur = (await query('SELECT author_id, status, body FROM articles WHERE article_id = $1', [id])).rows[0];
    if (!cur) return fail(404, 'No such article');
    if (String(cur.author_id) !== String(g.me.user_id)) return fail(403, 'You can only edit your own articles');
    if ((v.status ?? cur.status) === 'published' && !(v.body ?? cur.body).length) return fail(400, 'Please fix the highlighted fields', { fields: { body: 'Write something before publishing' } });

    await withTx(async db => {
      const sets = [], vals = [];
      const set = (col, x) => { vals.push(x); sets.push(`${col} = $${vals.length}`); };
      if (v.title !== undefined) set('title', v.title);
      if (v.category !== undefined) set('category', v.category);
      if (v.cover !== undefined) set('cover_image_url', v.cover);
      if (v.body !== undefined) { set('body', v.body); set('read_minutes', readMinutes(v.words)); }
      if (v.status !== undefined) {
        set('status', v.status);
        if (v.status === 'published') { sets.push('published_at = COALESCE(published_at, now())', 'published_once = TRUE'); }
      }
      if (sets.length) { vals.push(id); await db.query(`UPDATE articles SET ${sets.join(', ')} WHERE article_id = $${vals.length}`, vals); }
      if (v.matchIds !== undefined) {
        await db.query('DELETE FROM article_matches WHERE article_id = $1', [id]);
        if (v.matchIds.length) await db.query(`INSERT INTO article_matches (article_id, match_id) SELECT $1, unnest($2::int[])`, [id, v.matchIds]);
      }
      if (v.status === 'published') await db.query('UPDATE users SET is_author = TRUE WHERE user_id = $1', [g.me.user_id]);
    });
    return json({ article: await loadArticle(id, g.me.user_id) });
  } catch (err) { return dbError(err); }
}

// DELETE /api/articles/:id   (author only) – its comments, likes and saves are removed with it
export async function DELETE(req, { params }) {
  const id = bigId((await params).id); if (!id) return fail(404, 'No such article');
  const g = await requireUser(req, 'Sign in to delete your article'); if (g.res) return g.res;
  try {
    const r = await query('DELETE FROM articles WHERE article_id = $1 AND author_id = $2', [id, g.me.user_id]);
    return r.rowCount ? json({ ok: true }) : fail(404, 'No such article of yours');
  } catch (err) { return dbError(err); }
}
