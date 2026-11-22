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

// GET /api/predictions
//   -> { weekStart, mine: { [matchId]: { pick, note } }, split: { [matchId]: { home, draw, away } }, leaders: [{ rank, handle, name, avatar, points }] }
//   mine   = the signed-in user's picks for this week's games ({} when signed out)
//   split  = how everyone picked this week (the page only shows it once you have picked)
//   leaders = last week's best predictors, scored with pointsFor() in lib/predictions.js
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

    // last week's leaderboard: every pick on a finished game of last week, scored in JS so the rule can change later
    const lw = await query(
      `SELECT p.user_id, p.pick, p.note, f.hs, f.aw,
              u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated
         FROM predictions p
         JOIN (${fx}) f ON f.id = p.match_id
         JOIN users u ON u.user_id = p.user_id
        WHERE f.ts >= $1 AND f.ts < $2 AND f.status = ANY($3)`, [new Date(pw), new Date(ws), FINISHED]);
    const total = new Map();
    for (const r of lw.rows) {
      const t = total.get(r.user_id) || { r, points: 0, n: 0 };
      t.points += pointsFor({ pick: r.pick, note: r.note }, { hs: r.hs, as: r.aw }); t.n++;
      total.set(r.user_id, t);
    }
    const leaders = [...total.values()]
      .filter(t => t.points > 0)
      .sort((a, b) => b.points - a.points || b.n - a.n || a.r.handle.localeCompare(b.r.handle))
      .slice(0, LEADERS)
      .map((t, i) => ({ rank: i + 1, ...person(t.r), points: t.points }));

    return json({ weekStart: ws, mine, split, leaders });
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
