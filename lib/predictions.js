// Shared by the /predictions page (browser) and /api/predictions (server): weeks, outcomes and the scoring rule. No server imports here.

export const MAX_NOTE = 280;
export const PICKS = ['home', 'draw', 'away'];
const WEEK = 7 * 86400000;

// Weeks are counted in ONE fixed time zone for everybody, so the whole site flips at the same moment.
// Baku = UTC+4 (no daylight saving). A prediction week runs Monday 00:00 Baku time -> next Monday 00:00 Baku time (= 20:00 UTC on Sunday).
// To use another zone change these two lines (and WEEK_OFFSET_HOURS in the scraper, sync_espn.py).
export const WEEK_OFFSET_HOURS = 4, WEEK_ZONE = 'Baku time';
const OFFSET = WEEK_OFFSET_HOURS * 3600000;

export function weekStart(ts = Date.now()) {
  const d = new Date(ts + OFFSET), day = (d.getUTCDay() + 6) % 7;          // Monday = 0, measured in the week zone
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - OFFSET;
}
export const weekEnd = ts => weekStart(ts) + WEEK;
export const prevWeekStart = ts => weekStart(ts) - WEEK;

// Result after the played score (a penalty shoot-out does not change it: 1-1 and pens is a draw).
export const outcomeOf = (hs, as) => hs > as ? 'home' : hs < as ? 'away' : 'draw';

/* ---------------------------------------------------------------------
   POINT SYSTEM: still to be decided. Everything that scores lives in this one function, and the leaderboard
   is recalculated from it every time, so changing the rule here also fixes past weeks. Placeholder: 1 point per correct pick.
   `p` = { pick, note }, `result` = { hs, as } (full-time score).
--------------------------------------------------------------------- */
export function pointsFor(p, result) {
  return p.pick === outcomeOf(result.hs, result.as) ? 1 : 0;
}
