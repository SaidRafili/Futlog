# Futlog (Next.js + PostgreSQL)

Everything is stored in one PostgreSQL database called **teams**
(tables: `teams`, `fixtures`, `users`, `articles`, `article_matches`, `article_saves`, `comments`, `likes`, `posts`, `reviews`, `match_ratings`, ...).

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

There is **no placeholder content any more**: articles, comments, feed posts, reviews, ratings and profiles all come from the database. A fresh site starts empty; create an account and write the first article.

## Profiles, activity, banner and settings (PostgreSQL)
Run `npm run db:schema` once (re-runnable; it upgrades an existing database). It adds `users.banner_url` / `banner_hue` and the tables
`user_matches` (watched / liked / on-site), `reviews`, `follows`, plus the `user_activity` view behind the **Activity** tab.

- `/profile/[handle]` – reads `GET /api/users/[handle]` (profile, counts, every tab, recent activity). A handle that is not in the `users` table shows "no such user".
  The owner also sees their drafts and a private **Saved** tab.
- `/settings` – edit name, bio, location, favourite team, profile photo, banner image and banner colour (`PUT /api/users/[handle]`).
  Images are resized in the browser, stored in the `users` table and served by `GET /api/users/[handle]/image/avatar|banner`.
  The first save creates your `users` row.
- Match page: the Watched and Like buttons save to the profile (`POST/DELETE /api/users/[handle]/matches`).
- Follow buttons save to `follows` (`POST/DELETE /api/follows`).
- **Sign in / sign up popup:** the header's *Sign in* button (and any Watched / Like / Follow click while signed out) opens it.
  `POST /api/auth/signup | login | logout`, `GET /api/auth/me`. Passwords are hashed with scrypt (`lib/password.mjs`); a random session
  token lives in an httpOnly cookie and only its hash is stored (`sessions` table). Failed sign-ins are rate-limited (`auth_attempts`),
  and every write checks the session and the request origin. Re-run `npm run db:schema` to add the two new tables.
- A user row created without a password (e.g. inserted by hand) can be claimed with
  `npm run user:claim -- handle you@example.com 'your password'`.
- Not included yet: email verification and "forgot password".
- Favicon: `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`, `app/manifest.js` (+ `public/icon-*.png`).

## Articles, comments, likes, saves, feed, reviews (PostgreSQL)
Run `npm run db:schema` again to add the new tables (safe to re-run). Every row has a `user_id` pointing at `users`.

| Table | What it stores |
|---|---|
| `articles` (+ `article_matches`) | author, title, category, body (one array item per paragraph), cover link, `status` draft/published, `published_at`, matches the article is about |
| `article_saves` | an article bookmarked by a user (the **Save** button) |
| `comments` | **one table for everything**: `target_type` = `match` / `article` / `review` / `post` + `target_id`, `parent_id` for replies, `edited_at` |
| `likes` | **one table for likes** on `article` / `comment` / `review` / `post`; primary key (user, type, id) = one like per person. A match "like" is `user_matches.kind = 'liked'` |
| `posts` | feed posts (max 280 characters, optional tagged match); replies to a post are `comments` with type `post` |
| `reviews` | match reviews (title, text, rating 1-10), one per user per match |
| `match_ratings` | the 1-10 rating bars on the match page |

Deleting an article / post / review / comment also deletes its comments and likes (trigger `delete_target_children`).

API (all writes need a signed-in user and a same-site request; you can only change your own rows):

- `GET/POST /api/articles`, `GET/PUT/DELETE /api/articles/:id` – create a draft or publish, edit, unpublish (`status: 'draft'`), delete
- `POST/DELETE /api/articles/:id/save` – bookmark / remove bookmark
- `GET/POST /api/comments`, `PUT/DELETE /api/comments/:id` – comments on any target, replies, edit, delete
- `POST/DELETE /api/likes` – body `{ type: 'article' | 'comment' | 'post' | 'review', id }`
- `GET/POST /api/posts`, `PUT/DELETE /api/posts/:id` – the feed
- `GET/POST/DELETE /api/reviews` – match reviews
- `GET/PUT/DELETE /api/matches/:id` – match counts, average rating, your rating
- `GET /api/users?suggest=1` – "Who to follow"

Pages: `/write` (new article), `/write/[id]` (edit), `/article/[id]`, `/feed`, and the **Saved** tab on your profile.
