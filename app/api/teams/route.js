import { query } from '@/lib/db';

export const dynamic = 'force-dynamic'; // always read fresh rows from Postgres

// Postgres folds unquoted column names to lower case (teamid, displayname, ...),
// so every column is aliased back to the camelCase keys the front-end already uses.
const SQL = `
  SELECT teamid            AS "teamId",
         location,
         name,
         abbreviation,
         displayname       AS "displayName",
         shortdisplayname  AS "shortDisplayName",
         TRIM(color)          AS color,
         TRIM(alternatecolor) AS "alternateColor",
         logourl           AS "logoURL",
         venueid           AS "venueId",
         slug
  FROM teams
  ORDER BY teamid`;

export async function GET() {
  try {
    const { rows } = await query(SQL);
    return Response.json(rows);
  } catch (err) {
    console.error('GET /api/teams failed:', err);
    return Response.json({ error: 'Could not load teams from the database' }, { status: 500 });
  }
}
