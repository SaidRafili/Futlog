import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Table columns are all VARCHAR, so everything is cast here.
// ::numeric::int also survives values like '2.0' that CSV imports often produce.
const SQL = `
  WITH f AS (
    SELECT NULLIF(TRIM(eventid), '')::numeric::bigint             AS event_id,
           NULLIF(TRIM("date"), '')::timestamptz                  AS ts,
           NULLIF(TRIM(leagueid), '')::numeric::int               AS league_id,
           COALESCE(NULLIF(TRIM(venueid), '')::numeric::int, 0)   AS venue_id,
           NULLIF(TRIM(attendance), '')::numeric::int             AS attendance,
           NULLIF(TRIM(hometeamid), '')::numeric::int             AS home_team_id,
           NULLIF(TRIM(awayteamid), '')::numeric::int             AS away_team_id,
           NULLIF(TRIM(hometeamscore), '')::numeric::int          AS home_score,
           NULLIF(TRIM(awayteamscore), '')::numeric::int          AS away_score,
           NULLIF(TRIM(hometeamshootoutscore), '')::numeric::int  AS home_so,
           NULLIF(TRIM(awayteamshootoutscore), '')::numeric::int  AS away_so,
           NULLIF(TRIM(statusid), '')::numeric::int               AS status_id
    FROM fixtures
  )
  SELECT event_id     AS "eventId",
         to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS "date",
         league_id    AS "leagueId",
         venue_id     AS "venueId",
         attendance,
         home_team_id AS "homeTeamId",
         away_team_id AS "awayTeamId",
         home_score   AS "homeTeamScore",
         away_score   AS "awayTeamScore",
         home_so      AS "homeTeamShootoutScore",
         away_so      AS "awayTeamShootoutScore",
         status_id    AS "statusId"
  FROM f
  ORDER BY ts DESC NULLS LAST, event_id DESC`;

export async function GET() {
  try {
    const { rows } = await query(SQL);
    return Response.json(rows);
  } catch (err) {
    console.error('GET /api/fixtures failed:', err);
    const dev = process.env.NODE_ENV !== 'production';
    return Response.json(
      {
        error: 'Could not load fixtures from the database',
        detail: dev ? err.message : undefined,
        code: err.code || null,
      },
      { status: 500 }
    );
  }
}
