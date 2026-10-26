import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { bigId, person, posInt, requireUser } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELECT = `
  SELECT r.review_id, r.user_id, r.match_id, r.title, r.body, r.rating, r.created_at,
         u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated,
         (SELECT count(*)::int FROM likes l WHERE l.target_type = 'review' AND l.target_id = r.review_id) AS likes,
         (SELECT count(*)::int FROM comments c WHERE c.target_type = 'review' AND c.target_id = r.review_id) AS comments,
         EXISTS (SELECT 1 FROM likes l WHERE l.target_type = 'review' AND l.target_id = r.review_id AND l.user_id = $1::bigint) AS liked
    FROM reviews r JOIN users u ON u.user_id = r.user_id`;
const out = (r, meId) => ({
  id: Number(r.review_id), matchId: r.match_id, title: r.title, body: r.body || '', rating: r.rating, at: r.created_at,
  likes: r.likes, comments: r.comments, liked: r.liked, mine: meId != null && String(r.user_id) === String(meId), user: person(r),
});

// GET /api/reviews?matchId=123   -> the reviews written for that match, newest first
export async function GET(req) {
  const matchId = posInt(new URL(req.url).searchParams.get('matchId')); if (!matchId) return fail(400, 'Need matchId');
  try {
    const me = await getSessionUser(), meId = me?.user_id ?? null;
    const { rows } = await query(`${SELECT} WHERE r.match_id = $2 ORDER BY r.created_at DESC LIMIT 200`, [meId, matchId]);
    return json({ reviews: rows.map(r => out(r, meId)) });
  } catch (err) { return dbError(err); }
}

// POST /api/reviews   body { matchId, title, body?, rating 1-10 }   (one review per person per match)
export async function POST(req) {
  const g = await requireUser(req, 'Sign in to write a review'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const matchId = posInt(b.matchId), title = String(b.title ?? '').trim(), text = String(b.body ?? '').trim(), rating = Number(b.rating);
  const fields = {};
  if (!matchId) fields.matchId = 'Unknown match';
  if (!title || title.length > 200) fields.title = 'Add a title (up to 200 characters)';
  if (text.length > 5000) fields.body = 'Reviews are limited to 5000 characters';
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) fields.rating = 'Rate it from 1 to 10';
  if (Object.keys(fields).length) return fail(400, 'Please fix the highlighted fields', { fields });
  try {
    if ((await query('SELECT 1 FROM reviews WHERE user_id = $1 AND match_id = $2', [g.me.user_id, matchId])).rowCount)
      return fail(409, 'You already reviewed this match. Delete your review to write a new one.');
    const { rows } = await query('INSERT INTO reviews (user_id, match_id, title, body, rating) VALUES ($1, $2, $3, $4, $5) RETURNING review_id', [g.me.user_id, matchId, title, text || null, rating]);
    const r = (await query(`${SELECT} WHERE r.review_id = $2`, [g.me.user_id, rows[0].review_id])).rows[0];
    return json({ review: out(r, g.me.user_id) }, 201);
  } catch (err) { return dbError(err); }
}

// DELETE /api/reviews   body { id }   -> delete your own review
export async function DELETE(req) {
  const g = await requireUser(req); if (g.res) return g.res;
  const id = bigId((await readBody(req))?.id); if (!id) return fail(400, 'Need the review id');
  try {
    const r = await query('DELETE FROM reviews WHERE review_id = $1 AND user_id = $2', [id, g.me.user_id]);
    return r.rowCount ? json({ ok: true }) : fail(403, 'You can only delete your own reviews');
  } catch (err) { return dbError(err); }
}
