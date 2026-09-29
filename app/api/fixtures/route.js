import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Same field names the old fixtures.csv used; `date` keeps the "YYYY-MM-DD HH:MM:SS" (UTC) format.
const SQL = `
  SELECT event_id                                                   AS "eventId",
         to_char(event_date AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS date,
         league_id            AS "leagueId",
         COALESCE(venue_id, 0) AS "venueId",
         attendance,
         home_team_id         AS "homeTeamId",
         away_team_id         AS "awayTeamId",
         home_team_score      AS "homeTeamScore",
         away_team_score      AS "awayTeamScore",
         home_shootout_score  AS "homeTeamShootoutScore",
         away_shootout_score  AS "awayTeamShootoutScore",
         status_id            AS "statusId"
  FROM fixtures
  ORDER BY event_date DESC, event_id DESC`;

export async function GET() {
  try {
    const { rows } = await query(SQL);
    return Response.json(rows);
  } catch (err) {
    console.error('GET /api/fixtures failed:', err);
    // message + code only (no credentials), so the page can tell you what is wrong
    return Response.json({ error: 'Could not load fixtures from the database', detail: err.message || String(err), code: err.code || null }, { status: 500 });
  }
}
