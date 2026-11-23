// Data layer: loads teams + fixtures from PostgreSQL (/api/teams, /api/fixtures), matches fixture teams to teams,
// and builds the match helpers the UI needs. Articles, comments, profiles and feed posts have their own API routes.
import { MON } from './consts';
import { matchPath } from './slug';

/* ---------- settings ---------- */
export const FINISHED = new Set([28, 45, 46, 47]); // statusId shown as a result: 28 full time, 47 pens, 45/46 extra time
export const LEAGUES = {};        // leagueId -> name, filled from /api/lookups (or by hand, e.g. LEAGUES[745]='Liga Profesional')
export const LEAGUE_LOGO = {};    // leagueId -> logo URL, filled from /api/lookups
export const VENUE_PHOTO = {};    // venueId  -> { url, credit } stadium photo, filled from /api/lookups
export const VENUES = {};         // venueId  -> stadium name, filled from /api/lookups
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
      alt: hex(x.alternateColor, '#000000'), l: x.logoURL || '', slug: x.slug || '', nm: String(x.name || '').trim(), venueId: x.venueId, venueName: x.venueName || VENUES[x.venueId] || '',
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
    hs: +f.homeTeamScore || 0, as: +f.awayTeamScore || 0, ph: +f.homeTeamShootoutScore || 0, pa: +f.awayTeamShootoutScore || 0, status: +f.statusId || 0,
    season: String(f.season ?? '').trim(), hn: String(f.homeTeamName ?? '').trim(), an: String(f.awayTeamName ?? '').trim()
  }));
  if (!rows.length) throw new Error('the fixtures table is empty');
  return rows;
}

// Fixture team ids ARE the teams-table ids (sync_espn.py writes ESPN's team id, and teams.csv uses the same ids), so the id is the primary key.
// The HOME GROUND is only a fallback, never an override. It used to be the other way round (a team whose id did not agree with its venue was
// re-matched by venue), which broke every national team that plays in a club's stadium: Denmark at Parken -> F.C. Kobenhavn, Northern Ireland at
// Windsor Park -> Linfield, Romania -> Dinamo Bucuresti, and the reverse (Lille shown as France, because teams.csv gives France Lille's ground).
//  1. alias                                                          -> manual fix
//  2. id exists in the teams table                                   -> used. Only if the fixture's team NAME (from ESPN) clearly
//                                                                      disagrees AND a venue-unique team does match that name is the id overridden
//  3. id missing from the teams table, exactly one team owns the     -> matched by venue (needs >=3 home games, >=60% at that ground, and the
//     venue (and, when ESPN's name is known, the name fits)             name must fit when known)
// Returns Map(fixtureTeamId -> the teams table teamId).
const fold = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const nameFits = (t, name) => {          // does ESPN's name for the fixture team look like this team? (unknown name = no objection)
  const f = fold(name); if (!f) return true;
  return [t.n, t.short, t.nm].some(x => { const g = fold(x); return g && (g === f || g.includes(f) || f.includes(g)); });
};

function resolveTeams(rows, T, TL) {
  const cnt = new Map(), leagues = new Map(), ids = new Set(), names = new Map();
  for (const r of rows) {
    ids.add(r.h); ids.add(r.a);
    if (r.hn) names.set(r.h, r.hn); if (r.an) names.set(r.a, r.an);
    for (const id of [r.h, r.a]) { let l = leagues.get(id); if (!l) leagues.set(id, l = new Set()); l.add(r.leagueId); }
    if (r.venueId > 0) { let m = cnt.get(r.h); if (!m) cnt.set(r.h, m = new Map()); m.set(r.venueId, (m.get(r.venueId) || 0) + 1); }
  }
  const home = new Map();
  for (const [id, m] of cnt) { let v = 0, c = 0, n = 0; for (const [k, x] of m) { n += x; if (x > c) { c = x; v = k; } } home.set(id, { venue: v, n, share: c / n }); }
  const byVenue = {}; for (const t of TL) if (t.venueId > 0) (byVenue[t.venueId] || (byVenue[t.venueId] = [])).push(t);
  const venueOwner = (fid, name) => {      // the single teams-table team owning this fixture team's home ground, if the name fits
    const e = home.get(fid), own = e && e.n >= 3 && e.share >= .6 ? byVenue[e.venue] : null;
    return own && own.length === 1 && nameFits(own[0], name) ? own[0] : null;
  };

  const map = new Map(), repaired = [], n = { alias: 0, byId: 0, byVenue: 0, notInTeamsJson: 0 };
  for (const fid of ids) {
    const al = TEAM_ALIAS[fid]; if (al != null && T[al]) { map.set(fid, T[al].id); n.alias++; continue; }
    const t = T[fid], name = names.get(fid);
    if (t && TRUST_ID_WHEN_UNVERIFIED) {
      if (!nameFits(t, name)) {                                              // id points at a differently named team: only override if venue proves another
        const v = venueOwner(fid, name);
        if (v && v.id !== t.id) { map.set(fid, v.id); n.byVenue++; repaired.push({ fixtureTeamId: fid, teamsJsonId: v.id, team: v.n, fixtureName: name, idWouldBe: t.n }); continue; }
      }
      map.set(fid, t.id); n.byId++; continue;
    }
    const v = !t ? venueOwner(fid, name) : null;
    if (v) { map.set(fid, v.id); n.byVenue++; repaired.push({ fixtureTeamId: fid, teamsJsonId: v.id, team: v.n }); }
    else n.notInTeamsJson++;
  }
  console.info('Futlog team matching (fixtures -> teams):', n);
  if (repaired.length) console.info('Matched by venue, not by id:', repaired);
  return map;
}

export function buildMatches(rows, T, TL, map = resolveTeams(rows, T, TL)) {
  const out = [];
  for (const r of rows) {
    if (!FINISHED.has(r.status)) continue;
    const h = map.get(r.h), a = map.get(r.a); if (h == null || a == null || h === a) continue;
    out.push({
      id: r.id, h, a, hs: r.hs, as: r.as, ph: r.ph, pa: r.pa, leagueId: r.leagueId, comp: leagueName(r.leagueId),
      stage: r.ph + r.pa > 0 ? `Pens ${r.ph}–${r.pa}` : '', season: r.season || String(new Date(r.ts).getUTCFullYear()), leagueLogo: LEAGUE_LOGO[r.leagueId] || '',
      img: VENUE_PHOTO[r.venueId]?.url || '', imgCredit: VENUE_PHOTO[r.venueId]?.credit || '', ts: r.ts, venueId: r.venueId, att: r.att
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
    if (VENUES[m.venueId]) return VENUES[m.venueId];                       // name from the venues table
    return h.venueId === m.venueId ? venueOf(h) : 'Venue #' + m.venueId;
  };
  // counts (watched / liked / comments / ratings) come from /api/matches/:id, not from here
  const detail = m => {
    const b = new Date(m.ts), p2 = n => String(n).padStart(2, '0');
    const key = x => [x.h, x.a].sort().join();
    const pair = matches.filter(x => key(x) === key(m)).reverse();   // every meeting of these two teams, oldest first
    return {
      date: `${p2(b.getUTCDate())} ${MON[b.getUTCMonth()]} ${String(b.getUTCFullYear()).slice(2)}`,
      venue: matchVenue(m), pair, n: pair.indexOf(m) + 1, att: m.att > 0 ? m.att.toLocaleString('en-US') : '—',
      ko: `${p2(b.getUTCHours())}:${p2(b.getUTCMinutes())} UTC`
    };
  };
  const mhref = m => matchPath(m, T);      // /match/12345-arsenal-vs-chelsea-2026
  return { label, detail, mhref };
}

/* ---------- load everything ---------- */
async function get(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let why = '';
    try { const j = await res.json(); why = j.detail ? ' – ' + j.detail : ''; } catch { /* not JSON */ }
    throw new Error(url + ' returned HTTP ' + res.status + why);
  }
  return res;
}

// league names / logos and venue names (optional: if /api/lookups fails the old fallbacks are used)
export function applyLookups(j) {
  for (const l of j?.leagues || []) {
    if (l.leagueId == null) continue;
    if (l.name) LEAGUES[l.leagueId] = String(l.name).trim();
    if (l.logoURL) LEAGUE_LOGO[l.leagueId] = l.logoURL;
  }
  const safe = u => String(u).trim().replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');   // safe inside CSS url('...')
  for (const v of j?.venues || []) {
    if (v.venueId == null) continue;
    if (v.fullName) VENUES[v.venueId] = String(v.fullName).trim();
    if (v.photoURL) VENUE_PHOTO[v.venueId] = { url: safe(v.photoURL), credit: String(v.photoCredit || '').trim() };
  }
}

export async function loadAll() {
  const lookups = fetch('/api/lookups').then(r => r.ok ? r.json() : null).catch(() => null);
  const [teamsRes, fixturesRes] = await Promise.all([get('/api/teams'), get('/api/fixtures')]);
  applyLookups(await lookups);          // before parseTeams / buildMatches, which read these tables
  const { T, TL } = parseTeams(await teamsRes.json());
  const rows = parseFixtures(await fixturesRes.json());
  const teamMap = resolveTeams(rows, T, TL);        // fixture team id -> teams table id (also used for games that have not been played yet)
  const matches = buildMatches(rows, T, TL, teamMap);
  const MID = new Map(matches.map(m => [m.id, m]));
  console.info(`Futlog: ${matches.length} matches shown, ${new Date(matches[matches.length - 1].ts).toISOString().slice(0, 10)} to ${new Date(matches[0].ts).toISOString().slice(0, 10)}`);
  return {
    T, TL, matches, fixtures: rows, teamMap, byId: id => MID.get(id), ...makeHelpers(T, matches)
  };
}
