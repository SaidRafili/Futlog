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
- **Email verification (6-digit code):** both sign-up and sign-in are two steps. Step 1 (`POST /api/auth/signup | login`) checks the form / password and
  e-mails a 6-digit code from `futlogcom@gmail.com` (`lib/mail.js`, Gmail SMTP via nodemailer). Step 2 (`POST /api/auth/verify`) checks the code and only
  then creates the account / session; `POST /api/auth/resend` sends a new code. Codes last 10 minutes, allow 5 wrong tries, work once and are stored hashed
  (`auth_codes` table, `lib/otp.js`). E-mails per address / IP are rate-limited. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google *App password*) in
  `.env.local` and on Vercel, then run `npm install` and `npm run db:schema`. Without `GMAIL_APP_PASSWORD`, development prints the code in the terminal.
- Not included yet: "forgot password".
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


## Feed posts with pictures (Twitter-style)
Run `npm run db:schema` again (safe to re-run). It adds the `post_images` table and lets a post be pictures only.

- **Post box** (`components/PostComposer.js`): avatar, auto-growing text, up to **4 pictures** (pick, drag onto the box, or paste), picture descriptions (ALT),
  emoji, an optional tagged match, a 280-character ring, `Ctrl/Cmd + Enter` to post.
- Pictures are scaled down **in the browser** (longest side 1600 px, JPEG, under ~420 KB) and stored as bytes in `post_images`.
  `GET /api/post-images/:id` serves them with a one-year cache header (a picture never changes after it is saved). Deleting a post deletes its pictures.
- **Post text**: `#hashtags` link to a search for posts, `@handle` links to the profile, `https://` links are clickable (opened with `rel="noopener nofollow ugc"`).
- **Pictures in the feed**: 1 / 2 / 3 / 4 picture layouts like Twitter, click for a full-size viewer (arrow keys, Esc).
- `/post/[id]` is the page of a single post (its timestamp and the **Share** button link there; replies are open).
- The feed side column also shows **Trending hashtags**.

API: `POST /api/posts` body `{ body, matchId?, images?: [{ data: 'data:image/jpeg;base64,…', w, h, alt }] }` (text and/or pictures),
`GET /api/posts/:id`, `GET /api/posts?handle=alice`, `PUT /api/posts/:id` (edit text), `DELETE /api/posts/:id`.
The server checks the type, size (450 KB each) and file signature of every picture. Not included: animated GIFs (they become a still picture), video, editing pictures after posting.

## Search: matches, people, articles and posts
- **Header search box** has a live drop-down (people, articles, teams as you type; your recent searches when it is empty). Arrow keys + Enter work.
- **`/search?q=…&type=all|matches|articles|people|posts`**: tabs with result counts, highlighted words, "Show more", and a helpful empty state.
  A `#hashtag` search shows posts first. `real madrid vs bayern` still finds that fixture, whichever team is at home.
- **How results are ranked** (`lib/search.js`): every word you type must match (AND). A word scores by how it matches a field -
  exact > starts with > starts a word > appears inside > close to it (typo) - times how important the field is (a person's @handle / name,
  an article's title and author count more than a bio or the article text). Capitals and accents never matter ("muller" finds "Müller").
  Ties go to authors, popular (liked / followed) and newer results.
- **Typo tolerance** ("arsnal" -> Arsenal, "bellingam" -> Bellingham) uses Postgres' `pg_trgm`, enabled by `npm run db:schema`.
  If your host does not allow that extension, search still works, just without typo tolerance (the schema script prints a notice). Typos are only tolerated in
  names, handles, titles and post text, not in the long article text.
- `GET /api/search?q=&types=people,articles,posts&counts=posts&limit=&offset=` and `GET /api/search/suggest?q=`. Matches and teams are searched in the browser
  (`lib/matchsearch.js`) because the fixtures are already loaded there. Searching scans the tables (fast up to tens of thousands of rows); if you outgrow that,
  add trigram indexes on `lower(title)`, `lower(body)` and `lower(display_name)`.

## Random mix (home page, feed, comments)
`lib/shuffle.js` is a weighted random sampler (Efraimidis–Spirakis). Each item gets weight = engagement (log of likes and comments) × recency (half-life decay, with a floor so older items can still appear), then a random order is drawn, so liked / discussed / fresh content shows up more often but nothing is excluded. A final pass avoids showing the same author twice in a row.

- `GET /api/posts?tab=mix&limit=N[&seed=S]` – random posts (the **Mix** tab is the default on `/feed`, with a **Shuffle** button)
- `GET /api/articles?sort=random&limit=N[&exclude=ID][&seed=S]` – random articles (home page, "More to read" under an article)
- `GET /api/comments?type=match&top=1&random=1&limit=N[&seed=S]` – random comments (home page)
- Comments under an article / match / post default to the **Mix** order (click Mix again to reshuffle)
- No `seed` = a different result on every request; the same `seed` gives the same result.

## Responsive layout (phones and tablets)
The last block of `app/globals.css` ("Responsive v2") handles the header, feed and profile on small screens. It is deliberately at the end of the file, because rules that appear later win over the earlier `@media` blocks.
- **Header:** tablets keep one row (the search box shrinks instead of pushing "Sign in" off screen). Phones use two compact rows (logo + Write + account, then search + Matches/Feed) and the bar slides away while scrolling down and comes back when scrolling up (`components/Header.js`).
- **Feed:** the feed comes first; "Hot matches" becomes a sideways-scrolling filter strip above it and "Who to follow" sits below the posts. Long names/handles are truncated instead of overflowing.
- **Profile:** full-width header block, equal-width stat columns, and the section tabs form a sideways-scrolling strip that keeps the active tab in view.
- Desktop (above 1024px) is unchanged.

## Profile sections: liked vs written
- **Liked** (`?tab=liked`) = what the profile *liked*: posts (default), articles, comments, and matches (`&show=posts|articles|comments|matches`). Backed by `GET /api/users/:handle/likes?type=post|article|comment`; liked matches come with the profile data.
- **Posts** (`?tab=posts`) = feed posts the profile *wrote* (`GET /api/posts?handle=...`). The owner can edit / delete them there.
- **Comments** (`?tab=comments`) = comments and replies the profile *wrote* (`GET /api/users/:handle/comments`), each linking to the match / article / post it is on.
- **Articles** (`?tab=articles`) = articles the profile wrote (the owner also sees drafts, marked "Draft").
- The old links `?tab=likedposts` and `?tab=likedcomments` still work (they open Liked > Posts / Comments).
- The header numbers are Watched, Liked (everything the profile liked), Posts and Articles.
