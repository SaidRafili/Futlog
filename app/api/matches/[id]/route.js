import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { posInt, requireUser } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function stats(matchId, meId) {
  const { rows } = await query(
    `SELECT (SELECT count(*)::int FROM user_matches WHERE match_id = $1 AND kind = 'watched') AS watched,
            (SELECT count(*)::int FROM user_matches WHERE match_id = $1 AND kind = 'liked')   AS liked,
            (SELECT count(*)::int FROM comments WHERE target_type = 'match' AND target_id = $1) AS comments,
            (SELECT count(*)::int FROM reviews WHERE match_id = $1) AS reviews,
            (SELECT count(*)::int FROM match_ratings WHERE match_id = $1) AS ratings,
            (SELECT round(avg(rating)::numeric, 2)::float FROM match_ratings WHERE match_id = $1) AS avg,
            (SELECT rating FROM match_ratings WHERE match_id = $1 AND user_id = $2::bigint) AS mine`, [matchId, meId]);
  return rows[0];
}

// GET /api/matches/:id   -> how many people watched / liked / commented / rated this match, the average rating and your own rating
export async function GET(_req, { params }) {
  const id = posInt((await params).id); if (!id) return fail(404, 'No such match');
  try { const me = await getSessionUser(); return json(await stats(id, me?.user_id ?? null)); } catch (err) { return dbError(err); }
}

// PUT /api/matches/:id   body { rating: 1-10 }   -> save (or change) your rating      DELETE -> remove it
export async function PUT(req, { params }) {
  const id = posInt((await params).id); if (!id) return fail(404, 'No such match');
  const g = await requireUser(req, 'Sign in to rate matches'); if (g.res) return g.res;
  const rating = Number((await readBody(req))?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) return fail(400, 'Rate it from 1 to 10');
  try {
    await query(`INSERT INTO match_ratings (user_id, match_id, rating) VALUES ($1, $2, $3) ON CONFLICT (user_id, match_id) DO UPDATE SET rating = EXCLUDED.rating`, [g.me.user_id, id, rating]);
    return json(await stats(id, g.me.user_id));
  } catch (err) { return dbError(err); }
}

export async function DELETE(req, { params }) {
  const id = posInt((await params).id); if (!id) return fail(404, 'No such match');
  const g = await requireUser(req); if (g.res) return g.res;
  try {
    await query('DELETE FROM match_ratings WHERE user_id = $1 AND match_id = $2', [g.me.user_id, id]);
    return json(await stats(id, g.me.user_id));
  } catch (err) { return dbError(err); }
}
