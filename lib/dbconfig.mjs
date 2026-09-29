// Shared by the app (lib/db.js) and the import script. Plain ESM, no framework imports.
//
// The app always talks to the database called "teams" (override with DB_NAME).
// The database in DATABASE_URL (Neon's default is "neondb") is ignored: only host, user,
// password and SSL options are taken from the URL.
export const DB_NAME = process.env.DB_NAME || 'teams';

export function getPoolConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/' + encodeURIComponent(DB_NAME);
    return { connectionString: url.toString(), max: 5, idleTimeoutMillis: 10000 };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: +(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: DB_NAME,
    max: 5,
  };
}
