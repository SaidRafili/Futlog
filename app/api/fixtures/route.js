
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SQL = `
  SELECT
         event_id              AS "eventId",
         to_char(
           date::timestamp,
           'YYYY-MM-DD HH24:MI:SS'
         )                     AS date,
         league_id             AS "leagueId",
         COALESCE(venue_id::integer, 0) AS "venueId",
         attendance,
         home_team_id          AS "homeTeamId",
         away_team_id          AS "awayTeamId",
         home_team_score       AS "homeTeamScore",
         away_team_score       AS "awayTeamScore",
         home_team_shootout_score AS "homeTeamShootoutScore",
         away_team_shootout_score AS "awayTeamShootoutScore",
         status_id             AS "statusId"
  FROM fixtures
  ORDER BY date::timestamp DESC, event_id DESC
`;

export async function GET() {
  try {
    const { rows } = await query(SQL);
    return Response.json(rows);
  } catch (err) {
    console.error('GET /api/fixtures failed:', err);

    return Response.json(
      {
        error: 'Could not load fixtures from the database',
        detail: err.message || String(err),
        code: err.code || null,
      },
      { status: 500 }
    );
  }
}
