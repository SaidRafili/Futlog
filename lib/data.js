// Data layer: loads teams + fixtures from PostgreSQL (/api/teams, /api/fixtures), matches fixture teams to teams,
// and builds the match helpers the UI needs. Articles, comments, profiles and feed posts have their own API routes.
import { MON } from './consts';

/* ---------- settings ---------- */
export const FINISHED = new Set([28, 45, 46, 47]); // statusId shown as a result: 28 full time, 47 pens, 45/46 extra time
export const LEAGUES = {};        // leagueId -> name, filled from /api/lookups (or by hand, e.g. LEAGUES[745]='Liga Profesional')
export const LEAGUE_LOGO = {};    // leagueId -> logo URL, filled from /api/lookups
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
      alt: hex(x.alternateColor, '#000000'), l: x.logoURL || '', slug: x.slug || '', venueId: x.venueId, venueName: x.venueName || VENUES[x.venueId] || '',
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
    season: String(f.season ?? '').trim()
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
      stage: r.ph + r.pa > 0 ? `Pens ${r.ph}–${r.pa}` : '', season: r.season || String(new Date(r.ts).getUTCFullYear()), leagueLogo: LEAGUE_LOGO[r.leagueId] || '', ts: r.ts, venueId: r.venueId, att: r.att
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
  return { label, detail };
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
function applyLookups(j) {
  for (const l of j?.leagues || []) {
    if (l.leagueId == null) continue;
    if (l.name) LEAGUES[l.leagueId] = String(l.name).trim();
    if (l.logoURL) LEAGUE_LOGO[l.leagueId] = l.logoURL;
  }
  for (const v of j?.venues || []) if (v.venueId != null && v.fullName) VENUES[v.venueId] = String(v.fullName).trim();
}

export async function loadAll() {
  const lookups = fetch('/api/lookups').then(r => r.ok ? r.json() : null).catch(() => null);
  const [teamsRes, fixturesRes] = await Promise.all([get('/api/teams'), get('/api/fixtures')]);
  applyLookups(await lookups);          // before parseTeams / buildMatches, which read these tables
  const { T, TL } = parseTeams(await teamsRes.json());
  const rows = parseFixtures(await fixturesRes.json());
  const matches = buildMatches(rows, T, TL);
  const MID = new Map(matches.map(m => [m.id, m]));
  console.info(`Futlog: ${matches.length} matches shown, ${new Date(matches[matches.length - 1].ts).toISOString().slice(0, 10)} to ${new Date(matches[0].ts).toISOString().slice(0, 10)}`);
  return {
    T, TL, matches, byId: id => MID.get(id), ...makeHelpers(T, matches)
  };
}
