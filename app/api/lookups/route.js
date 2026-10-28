import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// League names / logos / season label and venue names, read from the `leagues` and `venues` tables.
// Each table is optional: if one is missing the site still works and falls back to "League 9" / "Venue #id".
const LEAGUES_SQL = `
  SELECT leagueid   AS "leagueId",
         name,
         shortname  AS "shortName",
         season,
         logourl    AS "logoURL",
         slug
  FROM leagues`;

const VENUES_SQL = `
  SELECT venueid      AS "venueId",
         fullname     AS "fullName",
         photourl     AS "photoURL",
         photocredit  AS "photoCredit"
  FROM venues`;

// older `venues` table without the photo columns: names only
const VENUES_NO_PHOTO_SQL = `
  SELECT venueid AS "venueId", fullname AS "fullName" FROM venues`;

async function rowsOf(sql, what) {
  try { return (await query(sql)).rows; }
  catch (err) { console.warn(`GET /api/lookups: could not read ${what}:`, err.message); return []; }
}

async function venueRows() {
  try { return (await query(VENUES_SQL)).rows; }
  catch { return rowsOf(VENUES_NO_PHOTO_SQL, 'venues'); }
}

export async function GET() {
  const [leagues, venues] = await Promise.all([rowsOf(LEAGUES_SQL, 'leagues'), venueRows()]);
  return Response.json({ leagues, venues });
}
