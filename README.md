# Futlog (Next.js + PostgreSQL)

Everything is stored in one PostgreSQL database called **teams**
(tables: `teams`, `fixtures`, `users`, `articles`, `article_matches`).

## Setup
1. **Create the database** (Neon: Project -> Branch -> Databases -> New database, name `teams`;
   or `CREATE DATABASE teams;` in psql).
2. **Create the tables:** open the SQL Editor on the `teams` database and run `scripts/schema.sql`
   (or `psql "postgresql://.../teams?sslmode=require" -f scripts/schema.sql`).
3. **Load your teams** into the `teams` table.
4. **Connection:** `cp .env.example .env.local` and set `DATABASE_URL`.
   On Vercel add `DATABASE_URL` in Settings -> Environment Variables, then redeploy.
5. **Load fixtures:** `npm install`, then `npm run import:fixtures -- path/to/fixtures.csv`
   (safe to re-run; rows are upserted by eventId).
6. `npm run dev` -> http://localhost:3000

## How the database is wired in
- `lib/dbconfig.mjs` – connection settings; always selects the database `teams` (override with `DB_NAME`)
- `lib/db.js` – shared `pg` pool (server only)
- `app/api/teams/route.js` – `GET /api/teams`
- `app/api/fixtures/route.js` – `GET /api/fixtures`
- `scripts/import-fixtures.mjs` – CSV -> `fixtures` table
- `lib/data.js` – `loadAll()` fetches both endpoints

Articles and profiles still use demo data from `lib/demo.js` (tables exist, API not wired yet).
