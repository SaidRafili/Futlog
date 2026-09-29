# Futlog (Next.js + PostgreSQL)

## Setup
1. Create the table in your database (Neon: SQL Editor, paste `scripts/schema.sql`; or
   `psql "$DATABASE_URL" -f scripts/schema.sql`). Then load your team rows into `teams`
   (e.g. `\copy teams FROM 'teams.csv' CSV HEADER`).
2. `cp .env.example .env.local` and set `DATABASE_URL` (pooled Neon string).
   On Vercel add `DATABASE_URL` under Settings -> Environment Variables and redeploy.
3. Put `fixtures.csv` in `public/`.
4. `npm install` → `npm run dev` → http://localhost:3000

## How the database is wired in
- `lib/db.js` – shared `pg` connection pool (server only)
- `app/api/teams/route.js` – `GET /api/teams` runs `SELECT ... FROM teams` and returns the same JSON shape `teams.json` had
- `lib/data.js` – `loadAll()` now fetches `/api/teams` instead of `/teams.json`
- `fixtures.csv` is still read from `public/`

## Structure
See `app/` (routes), `components/`, `components/views/`, `lib/`.
