import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// output key -> accepted column names (compared lower-case, underscores removed)
const FIELDS = {
  eventId: ['eventid'],
  date: ['date', 'eventdate'],
  leagueId: ['leagueid'],
  venueId: ['venueid'],
  attendance: ['attendance'],
  homeTeamId: ['hometeamid'],
  awayTeamId: ['awayteamid'],
  homeTeamScore: ['hometeamscore'],
  awayTeamScore: ['awayteamscore'],
  homeTeamShootoutScore: ['hometeamshootoutscore', 'homeshootoutscore'],
  awayTeamShootoutScore: ['awayteamshootoutscore', 'awayshootoutscore'],
  statusId: ['statusid'],
  season: ['seasontype'],
};
const REQUIRED = ['eventId', 'date', 'homeTeamId', 'awayTeamId'];

const norm = (s) => s.toLowerCase().replace(/_/g, '');
const quote = (s) => '"' + s.replace(/"/g, '""') + '"';
const isText = (t) => /char|text/i.test(t);

const textExpr = (c) =>
  isText(c.data_type)
    ? `NULLIF(TRIM(${quote(c.column_name)}), '')`
    : `${quote(c.column_name)}::text`;

const intExpr = (c) =>
  isText(c.data_type)
    ? `NULLIF(TRIM(${quote(c.column_name)}), '')::numeric::int`
    : `${quote(c.column_name)}::int`;

const dateExpr = (c) =>
  isText(c.data_type)
    ? `NULLIF(TRIM(${quote(c.column_name)}), '')::timestamptz`
    : `${quote(c.column_name)}::timestamptz`;

export async function GET() {
  try {
    const { rows: cols } = await query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE lower(table_name) = 'fixtures'
          AND table_schema = ANY (current_schemas(false))`
    );
    if (!cols.length) throw Object.assign(new Error('fixtures table not found'), { code: 'NOTABLE' });

    const byName = new Map(cols.map((c) => [norm(c.column_name), c]));
    const pick = (key) => {
      for (const n of FIELDS[key]) if (byName.has(n)) return byName.get(n);
      return null;
    };

    const missing = REQUIRED.filter((k) => !pick(k));
    if (missing.length) {
      throw Object.assign(
        new Error(`Missing columns for: ${missing.join(', ')}. Found: ${cols.map((c) => c.column_name).join(', ')}`),
        { code: 'NOCOLS' }
      );
    }

    const select = Object.keys(FIELDS).map((key) => {
      const c = pick(key);
      if (!c) return `NULL AS ${quote(key)}`;
      if (key === 'date') return `${dateExpr(c)} AS ts`;
      if (key === 'season') return `${textExpr(c)} AS ${quote(key)}`;
      if (key === 'venueId') return `COALESCE(${intExpr(c)}, 0) AS ${quote(key)}`;
      return `${intExpr(c)} AS ${quote(key)}`;
    });

    const sql = `
      WITH f AS (SELECT ${select.join(', ')} FROM fixtures)
      SELECT "eventId",
             to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS "date",
             "leagueId", "venueId", attendance, "homeTeamId", "awayTeamId",
             "homeTeamScore", "awayTeamScore",
             "homeTeamShootoutScore", "awayTeamShootoutScore", "statusId", season
        FROM f
       ORDER BY ts DESC NULLS LAST, "eventId" DESC`;

    const { rows } = await query(sql);
    return Response.json(rows);
  } catch (err) {
    console.error('GET /api/fixtures failed:', err);
    // Keep detail visible until it works, then change to: undefined
    return Response.json(
      { error: 'Could not load fixtures from the database', detail: err.message, code: err.code || null },
      { status: 500 }
    );
  }
}
