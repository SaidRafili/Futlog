import { query } from '@/lib/db';
import { fixturesSql } from '@/lib/fixturesql';
import { getSessionUser } from '@/lib/auth';
import { person } from '@/lib/content';
import { dbError, json } from '@/lib/users';
import { outcomeOf, pointsFor, weekStart } from '@/lib/predictions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FINISHED = [28, 45, 46, 47];      // same statuses as FINISHED in lib/data.js
const MAX_ROWS = 200;
const PERFECT_MIN = 3;                  // a "perfect week" needs at least this many finished predictions, all correct

const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;

// GET /api/predictions/stats
//   -> { summary, entries: [...], total, myRank }
//   entries are sorted as a leaderboard: points, then accuracy, then number of finished predictions, then best streak.
//   Points come from pointsFor() in lib/predictions.js, so changing the scoring rule there also changes this board.
//   "correct" is always pick === final result, whatever the scoring rule is.
export async function GET() {
  try {
    const me = await getSessionUser(), fx = await fixturesSql();
    const { rows } = await query(
      `SELECT p.user_id, p.pick, (p.note IS NOT NULL AND p.note <> '') AS has_note,
              f.id AS match_id, f.ts, f.hs, f.aw, f.status,
              u.handle, u.display_name, u.avatar_url, u.updated_at AS u_updated
         FROM predictions p
         JOIN (${fx}) f ON f.id = p.match_id
         JOIN users u ON u.user_id = p.user_id
        WHERE f.ts IS NOT NULL
        ORDER BY f.ts, f.id`);

    const thisWeek = weekStart(Date.now());
    const users = new Map();
    const weeks = new Map();                       // week start -> Map(user_id -> points that week), finished games only
    const matches = new Set(), settledMatches = new Map();
    const sum = { predictions: 0, settled: 0, correct: 0, notes: 0, open: 0 };
    const picked = { home: 0, draw: 0, away: 0 };

    for (const r of rows) {
      const u = users.get(r.user_id) || {
        r, n: 0, settled: 0, correct: 0, points: 0, run: 0, best: 0, notes: 0, form: [],
        wk: new Map(), picks: { home: { n: 0, done: 0, ok: 0 }, draw: { n: 0, done: 0, ok: 0 }, away: { n: 0, done: 0, ok: 0 } },
      };
      users.set(r.user_id, u);

      u.n++; sum.predictions++; matches.add(r.match_id); picked[r.pick]++;
      if (r.has_note) { u.notes++; sum.notes++; }
      u.picks[r.pick].n++;

      const done = FINISHED.includes(r.status) && r.hs != null && r.aw != null;
      if (!done) { sum.open++; continue; }

      const result = outcomeOf(r.hs, r.aw), ok = r.pick === result;
      const pts = pointsFor({ pick: r.pick, note: r.has_note ? 'x' : null }, { hs: r.hs, as: r.aw });
      u.settled++; sum.settled++; settledMatches.set(r.match_id, result); u.picks[r.pick].done++;
      u.points += pts;
      if (ok) { u.correct++; sum.correct++; u.picks[r.pick].ok++; u.run++; u.best = Math.max(u.best, u.run); }
      else u.run = 0;
      u.form.push(ok ? 'W' : 'L');
      if (u.form.length > 5) u.form.shift();

      const wk = weekStart(new Date(r.ts).getTime());
      const w = u.wk.get(wk) || { points: 0, settled: 0, correct: 0 };
      w.points += pts; w.settled++; if (ok) w.correct++;
      u.wk.set(wk, w);
      const wb = weeks.get(wk) || new Map();
      wb.set(r.user_id, (wb.get(r.user_id) || 0) + pts);
      weeks.set(wk, wb);
    }

    // weekly titles = finished weeks in which the user topped the board (shared on a tie, needs at least 1 point)
    const titles = new Map();
    for (const [wk, board] of weeks) {
      if (wk >= thisWeek) continue;
      const top = Math.max(...board.values());
      if (top <= 0) continue;
      for (const [id, p] of board) if (p === top) titles.set(id, (titles.get(id) || 0) + 1);
    }

    const all = [...users.entries()].map(([id, u]) => {
      let bestWeek = 0, perfect = 0;
      for (const [wk, w] of u.wk) {
        bestWeek = Math.max(bestWeek, w.points);
        if (wk < thisWeek && w.settled >= PERFECT_MIN && w.correct === w.settled) perfect++;
      }
      return {
        id,
        ...person(u.r),
        points: u.points,
        predictions: u.n,
        settled: u.settled,
        correct: u.correct,
        wrong: u.settled - u.correct,
        pending: u.n - u.settled,
        accuracy: pct(u.correct, u.settled),
        streak: u.run,
        bestStreak: u.best,
        form: u.form,
        bestWeek,
        weekTitles: titles.get(id) || 0,
        perfectWeeks: perfect,
        weeksPlayed: u.wk.size,
        notes: u.notes,
        picks: u.picks,
      };
    }).sort((a, b) =>
      b.points - a.points
      || (b.accuracy ?? -1) - (a.accuracy ?? -1)
      || b.settled - a.settled
      || b.bestStreak - a.bestStreak
      || a.handle.localeCompare(b.handle));

    const ranked = all.map((e, i) => ({ rank: i + 1, ...e }));
    const mine = me ? ranked.find(e => String(e.id) === String(me.user_id)) : null;
    const entries = ranked.slice(0, MAX_ROWS).map(({ id, ...e }) => ({ ...e, me: !!mine && id === mine.id }));
    if (mine && mine.rank > MAX_ROWS) { const { id, ...e } = mine; entries.push({ ...e, me: true }); }

    // how the finished games that were predicted actually ended
    const results = { home: 0, draw: 0, away: 0 };
    for (const v of settledMatches.values()) results[v]++;
    const top = ranked.reduce((b, e) => e.bestStreak > (b?.bestStreak || 0) ? e : b, null);

    return json({
      summary: {
        predictors: ranked.length,
        predictions: sum.predictions,
        settled: sum.settled,
        correct: sum.correct,
        accuracy: pct(sum.correct, sum.settled),
        matches: matches.size,
        notes: sum.notes,
        open: sum.open,
        weeks: weeks.size,
        picked,
        results,
        longestStreak: top ? { handle: top.handle, name: top.name, length: top.bestStreak } : null,
      },
      entries,
      total: ranked.length,
      myRank: mine?.rank || null,
    });
  } catch (err) { return dbError(err); }
}
