// Server-only: a SQL sub-query over the `fixtures` table with fixed column names, whatever the table calls them and whatever type they have.
// Your scraper (ScrapeFixtures) writes varchar columns called "date", "event_id", "status_id" ...; scripts/schema.sql uses event_date and typed columns.
// Both work: names are matched like /api/fixtures does (lower-case, underscores ignored) and text columns are cast.
//   FX gives:  id (int), ts (timestamptz), status (int), hs (int), aw (int)      use it as  JOIN (${await fixturesSql()}) f ON f.id = p.match_id
import { query } from './db';

const quote = s => '"' + s.replace(/"/g, '""') + '"';
const isText = t => /char|text/i.test(t);
const norm = s => s.toLowerCase().replace(/_/g, '');
const WANT = { id: ['eventid'], ts: ['eventdate', 'date'], status: ['statusid'], hs: ['hometeamscore'], aw: ['awayteamscore'] };

let cached = null;
export function fixturesSql() {
  if (!cached) cached = build().catch(e => { cached = null; throw e; });
  return cached;
}

async function build() {
  const { rows } = await query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE lower(table_name) = 'fixtures' AND table_schema = ANY (current_schemas(false))`);
  if (!rows.length) throw Object.assign(new Error('fixtures table not found'), { code: '42P01' });
  const by = new Map(rows.map(c => [norm(c.column_name), c]));
  const parts = [];
  for (const [key, names] of Object.entries(WANT)) {
    const c = names.map(n => by.get(n)).find(Boolean);
    if (!c) throw Object.assign(new Error(`fixtures has no ${names[0]} column`), { code: '42703' });
    const q = quote(c.column_name), t = isText(c.data_type);
    parts.push(`${key === 'ts' ? (t ? `NULLIF(TRIM(${q}), '')::timestamptz` : `${q}::timestamptz`)
                              : (t ? `NULLIF(TRIM(${q}), '')::numeric::int` : `${q}::int`)} AS ${key}`);
  }
  return `SELECT ${parts.join(', ')} FROM fixtures`;
}
