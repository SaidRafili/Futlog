import { query } from '@/lib/db';
import { fixturesSql } from '@/lib/fixturesql';
import { getSessionUser } from '@/lib/auth';
import { posInt, person, requireUser } from '@/lib/content';
import { dbError, fail, json, readBody } from '@/lib/users';
import { MAX_NOTE, PICKS, pointsFor, prevWeekStart, weekEnd, weekStart } from '@/lib/predictions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FINISHED = [28, 45, 46, 47];      // same statuses as FINISHED in lib/data.js
const LEADERS = 10;

// Top predictors over games with kick-off in [from, to). Only finished games score; with `everyone` anybody who
// picked any game in the window is listed (0 points until a game they picked has finished).
async function board(fx, from, to, everyone = false) {
  const { rows } = await query(
    `SELECT p.user_id, p.pick, p.note, f.hs, f.aw, f.status,
            u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated
       FROM predictions p
       JOIN (${fx}) f ON f.id = p.match_id
       JOIN users u ON u.user_id = p.user_id
      WHERE f.ts >= $1 AND f.ts < $2 AND ($4::boolean OR f.status = ANY($3))`, [new Date(from), new Date(to), FINISHED, everyone]);
  const total = new Map();
  for (const r of rows) {
    const t = total.get(r.user_id) || { r, points: 0, n: 0 };
    if (FINISHED.includes(r.status)) t.points += pointsFor({ pick: r.pick, note: r.note }, { hs: r.hs, as: r.aw });
    t.n++;
    total.set(r.user_id, t);
  }
  return [...total.values()]
    .filter(t => everyone || t.points > 0)
    .sort((a, b) => b.points - a.points || b.n - a.n || a.r.handle.localeCompare(b.r.handle))
    .slice(0, LEADERS)
    .map((t, i) => ({ rank: i + 1, ...person(t.r), points: t.points }));
}

// GET /api/predictions
//   -> { weekStart, mine, split, live: [...], played, leaders: [...] }  (each board row = { rank, handle, name, avatar, points })
//   mine   = the signed-in user's picks for this week's games ({} when signed out)
//   split  = how everyone picked this week (the page only shows it once you have picked)
//   live    = this week's board so far (finished games only), scored with pointsFor() in lib/predictions.js
//   played  = how many of this week's games have finished
//   leaders = last week's final board
export async function GET() {
  try {
    const now = Date.now(), ws = weekStart(now), we = weekEnd(now), pw = prevWeekStart(now);
    const me = await getSessionUser(), fx = await fixturesSql();

    const mine = {};
    if (me) {
      const { rows } = await query(
        `SELECT p.match_id, p.pick, p.note FROM predictions p JOIN (${fx}) f ON f.id = p.match_id
          WHERE p.user_id = $1 AND f.ts >= $2 AND f.ts < $3`, [me.user_id, new Date(ws), new Date(we)]);
      for (const r of rows) mine[r.match_id] = { pick: r.pick, note: r.note || '' };
    }

    const split = {};
    const sp = await query(
      `SELECT p.match_id, p.pick, count(*)::int AS n FROM predictions p JOIN (${fx}) f ON f.id = p.match_id
        WHERE f.ts >= $1 AND f.ts < $2 GROUP BY p.match_id, p.pick`, [new Date(ws), new Date(we)]);
    for (const r of sp.rows) (split[r.match_id] ||= { home: 0, draw: 0, away: 0 })[r.pick] = r.n;

    // leaderboards: every pick on a finished game in the window, scored in JS so the rule can change later.
    // "live" = this week so far (grows as games finish), "leaders" = last week's final board.
    const [live, leaders, played] = await Promise.all([
      board(fx, ws, we, true),
      board(fx, pw, ws),
      query(`SELECT count(*)::int AS n FROM (${fx}) f WHERE f.ts >= $1 AND f.ts < $2 AND f.status = ANY($3)`, [new Date(ws), new Date(we), FINISHED]),
    ]);

    return json({ weekStart: ws, mine, split, live, played: played.rows[0]?.n || 0, leaders });
  } catch (err) { return dbError(err); }
}

// PUT /api/predictions   body { matchId, pick?, note? }
//   pick = 'home' | 'draw' | 'away'  -> save / change your pick (until kick-off)
//   note = text (max 280, '' removes it) -> your written prediction; needs a pick first. Notes start as 'pending' (moderation comes later).
export async function PUT(req) {
  const g = await requireUser(req, 'Sign in to make a prediction'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const matchId = posInt(b.matchId); if (!matchId) return fail(400, 'Bad matchId');
  const hasPick = b.pick !== undefined, hasNote = b.note !== undefined;
  if (!hasPick && !hasNote) return fail(400, 'Send a pick, a note, or both');
  if (hasPick && !PICKS.includes(b.pick)) return fail(400, 'Pick must be home, draw or away');
  const note = hasNote ? String(b.note ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : null;
  if (hasNote && note.length > MAX_NOTE) return fail(400, `Predictions are limited to ${MAX_NOTE} characters`);
  try {
    const now = Date.now();
    const { rows: fr } = await query(`SELECT ts FROM (${await fixturesSql()}) f WHERE f.id = $1`, [matchId]);
    if (!fr[0]) return fail(404, 'That match does not exist');
    const at = new Date(fr[0].ts).getTime();
    if (at < weekStart(now) || at >= weekEnd(now)) return fail(400, 'You can only predict this week\u2019s games');
    if (at <= now) return fail(409, 'Kick-off has passed: predictions for this game are closed');

    let row;
    if (hasPick) {
      ({ rows: [row] } = await query(
        `INSERT INTO predictions (user_id, match_id, pick, note) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, match_id) DO UPDATE SET pick = EXCLUDED.pick,
           note        = CASE WHEN $5::boolean THEN EXCLUDED.note ELSE predictions.note END,
           note_status = CASE WHEN $5::boolean THEN 'pending'     ELSE predictions.note_status END
         RETURNING pick, note`, [g.me.user_id, matchId, b.pick, hasNote && note ? note : null, hasNote]));
    } else {
      ({ rows: [row] } = await query(
        `UPDATE predictions SET note = $3, note_status = 'pending' WHERE user_id = $1 AND match_id = $2 RETURNING pick, note`,
        [g.me.user_id, matchId, note || null]));
      if (!row) return fail(400, 'Pick an outcome first, then add your written prediction');
    }
    return json({ matchId, pick: row.pick, note: row.note || '' });
  } catch (err) { return dbError(err); }
}

// DELETE /api/predictions   body { matchId }  -> withdraw your pick (and its written prediction) until kick-off
export async function DELETE(req) {
  const g = await requireUser(req, 'Sign in to change a prediction'); if (g.res) return g.res;
  const b = await readBody(req); if (!b) return fail(400, 'Send a JSON body');
  const matchId = posInt(b.matchId); if (!matchId) return fail(400, 'Bad matchId');
  try {
    const now = Date.now();
    const { rows: fr } = await query(`SELECT ts FROM (${await fixturesSql()}) f WHERE f.id = $1`, [matchId]);
    if (!fr[0]) return fail(404, 'That match does not exist');
    if (new Date(fr[0].ts).getTime() <= now) return fail(409, 'Kick-off has passed: predictions for this game are closed');
    await query(`DELETE FROM predictions WHERE user_id = $1 AND match_id = $2`, [g.me.user_id, matchId]);
    return json({ matchId, pick: null, note: '' });
  } catch (err) { return dbError(err); }
}
