import { query } from '@/lib/db';
import { DB_NAME } from '@/lib/dbconfig.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Open https://YOUR-SITE/api/health to see which database this deployment REALLY reads.
// Shows host/user/database only, never the password. Delete this file when you are done.
export async function GET() {
  let host = null, user = null;
  try { const u = new URL(process.env.DATABASE_URL); host = u.hostname; user = u.username; } catch {}
  const out = {
    vercelEnv: process.env.VERCEL_ENV || null,            // production | preview | development
    deployment: process.env.VERCEL_URL || null,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    dbHost: host, dbUser: user, dbNameUsed: DB_NAME,
  };
  try {
    out.db = (await query('select current_database() as db')).rows[0].db;
    out.tables = (await query(`select table_name from information_schema.tables where table_schema='public' order by 1`)).rows.map(r => r.table_name);
    out.teams = (await query('select count(*)::int as n from teams')).rows[0].n;
    out.fixtures = (await query('select count(*)::int as n from fixtures')).rows[0].n;
    out.users = (await query('select count(*)::int as n from users')).rows[0].n;
    return Response.json(out);
  } catch (err) {
    return Response.json({ ...out, code: err.code || null, detail: err.message }, { status: 500 });
  }
}
