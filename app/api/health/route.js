import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const out = { hasDatabaseUrl: !!process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL };
  try {
    out.db = (await query('select current_database() as db')).rows[0].db;
    out.tables = (await query(
      `select table_name from information_schema.tables where table_schema='public'`
    )).rows.map(r => r.table_name);
    out.teams = (await query('select count(*)::int as n from teams')).rows[0].n;
    out.fixtures = (await query('select count(*)::int as n from fixtures')).rows[0].n;
    out.sampleDate = (await query('select "date" from fixtures limit 3')).rows;
    return Response.json(out);
  } catch (err) {
    return Response.json({ ...out, code: err.code || null, detail: err.message }, { status: 500 });
  }
}
