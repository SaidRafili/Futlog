import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { ARTICLE_SELECT, articleOut, checkArticle, loadArticle, readMinutes, requireUser, withTx } from '@/lib/content';
import { cleanHandle, dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/articles?sort=top|new&limit=20&author=handle   published articles
//     &matchId=123 -> published articles about that match
//     &mine=1   -> the signed-in user's own articles, drafts included
//     &saved=1  -> the articles the signed-in user saved
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get('limit')) || 20, 1), 100);
  try {
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    let where = `a.status = 'published'`; const args = [meId];
    if (sp.get('mine') === '1' || sp.get('saved') === '1') {
      if (!me) return fail(401, 'Sign in to see your articles');
      where = sp.get('saved') === '1'
        ? `a.status = 'published' AND EXISTS (SELECT 1 FROM article_saves s WHERE s.article_id = a.article_id AND s.user_id = $1::bigint)`
        : `a.author_id = $1::bigint`;
    } else if (sp.get('matchId')) {
      const mid = Number(sp.get('matchId')); if (!Number.isSafeInteger(mid) || mid <= 0 || mid > 2147483647) return json({ articles: [] });
      args.push(mid); where += ` AND EXISTS (SELECT 1 FROM article_matches am WHERE am.article_id = a.article_id AND am.match_id = $2)`;
    } else if (sp.get('author')) {
      const h = cleanHandle(sp.get('author')); if (!h) return json({ articles: [] });
      args.push(h); where += ` AND u.handle = $2`;
    }
    const order = sp.get('mine') === '1' ? 'a.updated_at DESC'
      : sp.get('sort') === 'top' ? 'likes DESC, comments DESC, a.published_at DESC' : 'a.published_at DESC';
    const { rows } = await query(`${ARTICLE_SELECT} WHERE ${where} ORDER BY ${order} LIMIT ${limit}`, args);
    return json({ articles: rows.map(r => articleOut(r, meId)) });
  } catch (err) { return dbError(err); }
}

// POST /api/articles   body { title, category, body, cover, matchIds, status: 'draft' | 'published' }
// body is the text of the article: blank lines separate paragraphs (an array of paragraphs also works).
export async function POST(req) {
  const g = await requireUser(req, 'Sign in to write an article'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const c = checkArticle({ status: 'draft', ...b }); if (c.errors) return fail(400, 'Please fix the highlighted fields', { fields: c.errors });
  const v = c.value, publish = v.status === 'published';
  try {
    const id = await withTx(async db => {
      const { rows } = await db.query(
        `INSERT INTO articles (author_id, title, category, read_minutes, cover_image_url, body, status, published_at, published_once)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN now() END, $8) RETURNING article_id`,
        [g.me.user_id, v.title, v.category, readMinutes(v.words), v.cover ?? null, v.body, v.status, publish]);
      const aid = rows[0].article_id;
      if (v.matchIds?.length) await db.query(`INSERT INTO article_matches (article_id, match_id) SELECT $1, unnest($2::int[])`, [aid, v.matchIds]);
      if (publish) await db.query('UPDATE users SET is_author = TRUE WHERE user_id = $1', [g.me.user_id]);
      return aid;
    });
    return json({ article: await loadArticle(id, g.me.user_id) }, 201);
  } catch (err) { return dbError(err); }
}
