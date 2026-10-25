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

Articles still use demo data from `lib/demo.js` (tables exist, API not wired yet).

## Profiles, activity, banner and settings (PostgreSQL)
Run `npm run db:schema` once (re-runnable; it upgrades an existing database). It adds `users.banner_url` / `banner_hue` and the tables
`user_matches` (watched / liked / on-site), `reviews`, `follows`, plus the `user_activity` view behind the **Activity** tab.
Optional demo content for the profile page: `npm run db:seed` (needs `fixtures` loaded).

- `/profile/[handle]` – reads `GET /api/users/[handle]` (profile, counts, every tab, recent activity). Handles that are not in the
  `users` table (the generated demo people) still show their demo profile.
- `/settings` – edit name, bio, location, favourite team, profile photo, banner image and banner colour (`PUT /api/users/[handle]`).
  Images are resized in the browser, stored in the `users` table and served by `GET /api/users/[handle]/image/avatar|banner`.
  The first save creates your `users` row.
- Match page: the Watched and Like buttons save to the profile (`POST/DELETE /api/users/[handle]/matches`).
- Follow buttons save to `follows` (`POST/DELETE /api/follows`).
- **No sign-in yet:** the whole site acts as the user in `ME_HANDLE` (`lib/util.js`, default `saidrafili`). The write endpoints only
  accept that handle. When you add auth, replace `ME_HANDLE` / `isMe()` (`lib/users.js`) with the session user.
- Favicon: `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`, `app/manifest.js` (+ `public/icon-*.png`).
