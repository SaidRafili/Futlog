// Data layer: loads teams + fixtures from PostgreSQL (/api/teams, /api/fixtures), matches fixture teams to teams,
// and builds everything the UI needs. Ported from app.js (no DOM code in here).
import {
  POOL, AUTH, baseComments, baseArticles, baseUpdates, MON, REVT, FT, FR
} from './demo';

/* ---------- settings ---------- */
export const FINISHED = new Set([28, 45, 46, 47]); // statusId shown as a result: 28 full time, 47 pens, 45/46 extra time
export const LEAGUES = {};        // optional names, e.g. LEAGUES[745]='Liga Profesional'
export const TEAM_ALIAS = {};     // optional manual fixes: { fixtureTeamId: teamsJsonTeamId }
export const TRUST_ID_WHEN_UNVERIFIED = true;
export const leagueName = id => LEAGUES[id] || 'League ' + id;

/* ---------- teams (from the PostgreSQL `teams` table) ---------- */
const hex = (v, d) => { const s = String(v ?? '').replace('#', '').trim(); return '#' + (/^[0-9a-f]{1,6}$/i.test(s) ? s.padStart(6, '0') : d); };

export function parseTeams(list) {
  if (!Array.isArray(list)) throw new Error('/api/teams must return an array of teams');
  const T = {}, TL = [];
  for (const x of list) {
    if (x == null || x.teamId == null) continue;
    const c = hex(x.color, '#333333'), n = parseInt(c.slice(1), 16);
    const lum = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; // pick readable text colour
    const name = String(x.displayName || x.name || 'Team ' + x.teamId).trim();
    const t = T[x.teamId] = {
      id: x.teamId, n: name, s: x.abbreviation || name.slice(0, 3).toUpperCase(), c, t: lum > 150 ? '#111' : '#fff',
      alt: hex(x.alternateColor, '#000000'), l: x.logoURL || '', slug: x.slug || '', venueId: x.venueId, venueName: x.venueName || '',
      loc: x.location || '', short: String(x.shortDisplayName || '').trim() || name
    };
    TL.push(t);
  }
  if (!TL.length) throw new Error('the teams table is empty');
  return { T, TL };
}

/* ---------- fixtures (from the PostgreSQL `fixtures` table) ---------- */
export function parseFixtures(list) {
  if (!Array.isArray(list)) throw new Error('/api/fixtures must return an array of fixtures');
  const rows = list.map(f => ({
    id: +f.eventId || 0, ts: Date.parse(String(f.date).trim().replace(' ', 'T') + 'Z') || 0, leagueId: +f.leagueId || 0,
    venueId: +f.venueId || 0, att: +f.attendance || 0, h: +f.homeTeamId || 0, a: +f.awayTeamId || 0,
    hs: +f.homeTeamScore || 0, as: +f.awayTeamScore || 0, ph: +f.homeTeamShootoutScore || 0, pa: +f.awayTeamShootoutScore || 0, status: +f.statusId || 0
  }));
  if (!rows.length) throw new Error('the fixtures table is empty');
  return rows;
}

// fixtures has team ids only, and the ids in the teams table can't be trusted, so teams are identified by their HOME GROUND:
//  1. teamId and home venue agree                                   -> confirmed
//  2. no id match, but exactly one team in the teams table owns the venue -> matched by venue
//  3. id match only -> used only if the team plays in a league where other teams were confirmed by 1/2
// Returns Map(fixtureTeamId -> the teams table teamId).
function resolveTeams(rows, T, TL) {
  const cnt = new Map(), leagues = new Map(), ids = new Set();
  for (const r of rows) {
    ids.add(r.h); ids.add(r.a);
    for (const id of [r.h, r.a]) { let l = leagues.get(id); if (!l) leagues.set(id, l = new Set()); l.add(r.leagueId); }
    if (r.venueId > 0) { let m = cnt.get(r.h); if (!m) cnt.set(r.h, m = new Map()); m.set(r.venueId, (m.get(r.venueId) || 0) + 1); }
  }
  const home = new Map();
  for (const [id, m] of cnt) { let v = 0, c = 0, n = 0; for (const [k, x] of m) { n += x; if (x > c) { c = x; v = k; } } home.set(id, { venue: v, n, share: c / n }); }
  const byVenue = {}; for (const t of TL) if (t.venueId > 0) (byVenue[t.venueId] || (byVenue[t.venueId] = [])).push(t);

  const map = new Map(), claimed = new Set(), repaired = [], n = { alias: 0, confirmed: 0, byVenue: 0, byId: 0, notInTeamsJson: 0 };
  const take = (fid, t, k) => { map.set(fid, t.id); claimed.add(t.id); n[k]++; };
  for (const fid of ids) {                                                   // 1
    const al = TEAM_ALIAS[fid]; if (al != null && T[al]) { take(fid, T[al], 'alias'); continue; }
    const t = T[fid], e = home.get(fid);
    if (t && e && e.venue === t.venueId) take(fid, t, 'confirmed');
  }
  for (const fid of ids) {                                                   // 2
    if (map.has(fid)) continue;
    const e = home.get(fid), own = e && e.n >= 3 && e.share >= .6 ? byVenue[e.venue] : null;
    if (own && own.length === 1 && !claimed.has(own[0].id)) { take(fid, own[0], 'byVenue'); repaired.push({ fixtureTeamId: fid, teamsJsonId: own[0].id, team: own[0].n }); }
  }
  const verified = {};
  for (const fid of map.keys()) for (const l of leagues.get(fid)) verified[l] = (verified[l] || 0) + 1;
  for (const fid of ids) {                                                   // 3
    if (map.has(fid)) continue;
    const t = T[fid];
    if (TRUST_ID_WHEN_UNVERIFIED && t && !claimed.has(t.id) && [...leagues.get(fid)].some(l => verified[l] >= 2)) take(fid, t, 'byId');
    else n.notInTeamsJson++;
  }
  console.info('Futlog team matching (fixtures -> teams):', n);
  if (repaired.length) console.info('Matched by venue, not by id:', repaired);
  return map;
}

function buildMatches(rows, T, TL) {
  const map = resolveTeams(rows, T, TL), out = [];
  for (const r of rows) {
    if (!FINISHED.has(r.status)) continue;
    const h = map.get(r.h), a = map.get(r.a); if (h == null || a == null || h === a) continue;
    out.push({
      id: r.id, h, a, hs: r.hs, as: r.as, ph: r.ph, pa: r.pa, leagueId: r.leagueId, comp: leagueName(r.leagueId),
      stage: r.ph + r.pa > 0 ? `Pens ${r.ph}–${r.pa}` : '', season: String(new Date(r.ts).getUTCFullYear()), ts: r.ts, venueId: r.venueId, att: r.att
    });
  }
  if (!out.length) throw new Error('none of the finished matches in fixtures involve two teams from the teams table');
  out.sort((x, y) => y.ts - x.ts || y.id - x.id); // newest first
  return out;
}

/* ---------- helpers that need the loaded data ---------- */
export const cs = m => m.comp + (m.stage ? ' ' + m.stage : '');     // "League 745 Pens 4–3"

function makeHelpers(T, matches) {
  const label = m => `${T[m.h].n} ${m.hs}–${m.as} ${T[m.a].n}, ${cs(m)} ${m.season}`;
  const venueOf = t => [t.venueName || (t.venueId ? 'Venue #' + t.venueId : ''), t.loc].filter(Boolean).join(' / ');
  const matchVenue = m => {
    const h = T[m.h];
    if (!(m.venueId > 0)) return 'Venue unknown';
    return h.venueId === m.venueId ? venueOf(h) : 'Venue #' + m.venueId;
  };
  // views / likes / ratings / comment counts are still demo numbers
  const detail = m => {
    const b = new Date(m.ts), p2 = n => String(n).padStart(2, '0');
    const views = 8000 + (m.id * 7919) % 40000;
    const key = x => [x.h, x.a].sort().join();
    const pair = matches.filter(x => key(x) === key(m)).reverse();   // every meeting of these two teams, oldest first
    return {
      date: `${p2(b.getUTCDate())} ${MON[b.getUTCMonth()]} ${String(b.getUTCFullYear()).slice(2)}`,
      views, likes: Math.round(views * .27), ccount: 300 + (m.id * 37) % 2900, avg: 6.5 + ((m.id * 13) % 30) / 10, rcount: Math.round(views * .06),
      venue: matchVenue(m), pair, n: pair.indexOf(m) + 1, att: m.att > 0 ? m.att.toLocaleString('en-US') : '—',
      ko: `${p2(b.getUTCHours())}:${p2(b.getUTCMinutes())} UTC`
    };
  };
  return { label, detail };
}

// The demo comments / articles / updates pointed at match ids 1..12: point them at the 12 latest matches.
function buildDemo(matches, T) {
  const pick = n => matches[Math.min(n - 1, matches.length - 1)].id;
  const comments = baseComments.map(c => ({ ...c, m: pick(c.m) }));
  const allArticles = baseArticles.map(a => ({ ...a, ms: a.ms.map(pick) }));
  const m0 = matches[0];
  const updates = baseUpdates.map(u => ({ ...u }));
  updates[0].h = '/match/' + m0.id;
  updates[0].t = `New match added: ${T[m0.h].n} ${m0.hs}–${m0.as} ${T[m0.a].n} (${cs(m0)} ${m0.season})`;
  return { comments, allArticles, updates };
}

function buildFeed(matches) {
  return FT.map((text, i) => ({
    id: i + 1, u: POOL[i % 12], m: matches[(i * 5) % matches.length].id,
    min: [12, 35, 90, 180, 300, 600, 900, 1500, 2200, 3000, 4200, 6000][i], likes: 20 + (i * 53) % 230, text,
    rep: i % 2 ? [] : [{ u: POOL[(i + 3) % 12], text: FR[i % 4], min: i * 7 + 5 }]
  }));
}

// Demo profiles: deterministic fake data derived from the handle.
function makeGetUser(matches, TL, allArticles) {
  const cache = new Map();
  return function getUser(h) {
    if (cache.has(h)) return cache.get(h);
    const ai = AUTH.findIndex(a => a.h === h), seed = [...h].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 100003, 7);
    const r = (k, n) => (seed * (k + 5) * (k + 11) + k * 7919) % n;
    const name = ai >= 0 ? AUTH[ai].n : (h.replace(/[._\d]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase()) || h);
    const watched = matches.slice(0, 60).filter((m, k) => h === 'saidrafili' || r(k, 5) < 3); // demo profiles only draw from the 60 latest matches
    const pick = (k, n) => { const l = watched.filter((m, i) => r(i + k, n) === 0); return l.length ? l : watched.slice(0, 1); };
    const others = POOL.filter(p => p !== h), list = k => { const l = others.filter((p, i) => r(i + k, 2) === 0); return l.length > 2 ? l : others.slice(0, 3); };
    const u = {
      h, name, watched, onsite: pick(20, 6), liked: pick(40, 3),
      reviews: watched.slice(0, 1 + r(3, 4)).map((m, i) => ({ t: REVT[(i + r(4, 6)) % 6], m, r: 6 + r(i + 30, 5), d: 2 + r(m.id + 50, 60) })),
      followers: list(60), following: list(80), arts: allArticles.filter(a => AUTH[a.au].h === h),
      bio: ai >= 0 ? AUTH[ai].bio : 'Football fan. Here for the matches, the arguments and the replays.',
      fav: TL[r(9, 12) % TL.length], loc: ['Baku', 'Madrid', 'Manchester', 'Milan', 'Munich', 'Lisbon'][r(10, 6)], joined: 2019 + r(11, 6)
    };
    cache.set(h, u);
    return u;
  };
}

/* ---------- load everything ---------- */
async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' returned HTTP ' + res.status);
  return res;
}

export async function loadAll() {
  const [teamsRes, fixturesRes] = await Promise.all([get('/api/teams'), get('/api/fixtures')]);
  const { T, TL } = parseTeams(await teamsRes.json());
  const rows = parseFixtures(await fixturesRes.json());
  const matches = buildMatches(rows, T, TL);
  const MID = new Map(matches.map(m => [m.id, m]));
  const demo = buildDemo(matches, T);
  console.info(`Futlog: ${matches.length} matches shown, ${new Date(matches[matches.length - 1].ts).toISOString().slice(0, 10)} to ${new Date(matches[0].ts).toISOString().slice(0, 10)}`);
  return {
    T, TL, matches, byId: id => MID.get(id), demo, feed0: buildFeed(matches),
    getUser: makeGetUser(matches, TL, demo.allArticles), ...makeHelpers(T, matches)
  };
}
