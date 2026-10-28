-- Run once against your database (on Neon the default database is "neondb"; the table is what matters, not the db name).
CREATE TABLE IF NOT EXISTS teams (
    teamId INT PRIMARY KEY,
    location VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10),
    displayName VARCHAR(100),
    shortDisplayName VARCHAR(100),
    color CHAR(6),
    alternateColor CHAR(6),
    logoURL TEXT,
    venueId INT,
    slug VARCHAR(100) UNIQUE
);


-- =====================================================================
-- USERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    handle         VARCHAR(30)  NOT NULL UNIQUE,          -- the @name used in /profile/[handle]
    display_name   VARCHAR(100) NOT NULL,
    email          VARCHAR(255) UNIQUE,                   -- nullable until you add sign-up
    password_hash  TEXT,                                  -- store a bcrypt/argon2 hash, NEVER the password
    bio            TEXT,
    location       VARCHAR(100),
    avatar_url     TEXT,
    favourite_team_id INT REFERENCES teams(teamId) ON DELETE SET NULL,
    is_author      BOOLEAN NOT NULL DEFAULT FALSE,        -- may publish articles
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),    -- "Joined" on the profile page
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_handle_format CHECK (handle ~ '^[a-z0-9._]{3,30}$')   -- lowercase, matches your demo handles
);

CREATE INDEX IF NOT EXISTS users_favourite_team_idx ON users (favourite_team_id);

-- =====================================================================
-- ARTICLES
-- =====================================================================
CREATE TABLE IF NOT EXISTS articles (
    article_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- used in /article/[id]
    author_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title         VARCHAR(300) NOT NULL,
    category      VARCHAR(50)  NOT NULL,                  -- "Analysis", "Tactics", "Scouting" ...
    read_minutes  SMALLINT CHECK (read_minutes > 0),      -- "8 min read"
    cover_image_url TEXT,
    body          TEXT[] NOT NULL DEFAULT '{}',           -- one array element per paragraph
    status        VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT articles_published_has_date CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS articles_author_idx    ON articles (author_id);
CREATE INDEX IF NOT EXISTS articles_published_idx ON articles (published_at DESC) WHERE status = 'published';

-- Matches an article is about (the "ms" list in the demo data).
-- match_id is the eventId from fixtures.csv, so there is no foreign key: that table is not in Postgres.
CREATE TABLE IF NOT EXISTS article_matches (
    article_id BIGINT NOT NULL REFERENCES articles(article_id) ON DELETE CASCADE,
    match_id   INT    NOT NULL,
    PRIMARY KEY (article_id, match_id)
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS articles_set_updated_at ON articles;
CREATE TRIGGER articles_set_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =====================================================================
-- FIXTURES  (replaces public/fixtures.csv)
-- =====================================================================
-- No foreign keys to teams on purpose: the app matches fixture teams to teams by home venue,
-- because ids in the two data sources don't always agree.
CREATE TABLE IF NOT EXISTS fixtures (
    event_id          INT PRIMARY KEY,               -- eventId, used in /match/[id]
    season_type       INT,
    league_id         INT NOT NULL,
    event_date        TIMESTAMPTZ NOT NULL,          -- CSV dates are UTC
    venue_id          INT,
    attendance        INT NOT NULL DEFAULT 0,
    home_team_id      INT NOT NULL,
    away_team_id      INT NOT NULL,
    home_team_winner  BOOLEAN,
    away_team_winner  BOOLEAN,
    home_team_score   INT NOT NULL DEFAULT 0,
    away_team_score   INT NOT NULL DEFAULT 0,
    home_shootout_score INT NOT NULL DEFAULT 0,
    away_shootout_score INT NOT NULL DEFAULT 0,
    status_id         INT NOT NULL,                  -- 28 full time, 45/46 extra time, 47 pens
    update_time       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS fixtures_date_idx   ON fixtures (event_date DESC);
CREATE INDEX IF NOT EXISTS fixtures_home_idx   ON fixtures (home_team_id);
CREATE INDEX IF NOT EXISTS fixtures_away_idx   ON fixtures (away_team_id);
CREATE INDEX IF NOT EXISTS fixtures_league_idx ON fixtures (league_id);


-- =====================================================================
-- PROFILES: banner + activity   (safe to re-run; upgrades an existing database in place)
-- =====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;        -- https URL or an uploaded image stored as a data: URL
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_hue SMALLINT;    -- 0-359, colour of the default banner gradient when there is no image
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_banner_hue_range;
ALTER TABLE users ADD CONSTRAINT users_banner_hue_range CHECK (banner_hue IS NULL OR banner_hue BETWEEN 0 AND 359);
-- (avatar_url, bio, location, display_name and favourite_team_id already exist in the users table above)

-- Matches a user has marked: watched / liked / on-site.  match_id = fixtures.event_id (no FK, same reason as article_matches).
CREATE TABLE IF NOT EXISTS user_matches (
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    match_id   INT    NOT NULL,
    kind       VARCHAR(10) NOT NULL CHECK (kind IN ('watched', 'liked', 'onsite')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, match_id, kind)
);
CREATE INDEX IF NOT EXISTS user_matches_recent_idx ON user_matches (user_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
    review_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    match_id   INT    NOT NULL,
    title      VARCHAR(200) NOT NULL,
    body       TEXT,
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_user_idx  ON reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_match_idx ON reviews (match_id);

CREATE TABLE IF NOT EXISTS follows (
    follower_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    followee_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);

-- One row per thing a user did, newest first when ordered by created_at. Powers the "Activity" tab.
CREATE OR REPLACE VIEW user_activity AS
    SELECT user_id, kind AS type, match_id, NULL::BIGINT AS target_user_id, NULL::BIGINT AS ref_id,
           NULL::TEXT AS title, NULL::SMALLINT AS rating, created_at
      FROM user_matches
    UNION ALL
    SELECT user_id, 'review', match_id, NULL, review_id, title, rating, created_at FROM reviews
    UNION ALL
    SELECT follower_id, 'follow', NULL, followee_id, NULL, NULL, NULL, created_at FROM follows
    UNION ALL
    SELECT author_id, 'article', NULL, NULL, article_id, title, NULL, published_at
      FROM articles WHERE status = 'published';


-- =====================================================================
-- SIGN-IN: sessions + failed-attempt log   (safe to re-run)
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));   -- emails are stored lower-case

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,                     -- sha256 of the cookie value; the cookie itself is never stored
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS auth_attempts (           -- failed sign-ins, used to block brute-force guessing
    key TEXT NOT NULL,                               -- 'id:<username or email>' or 'ip:<address>'
    at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_key_idx ON auth_attempts (key, at DESC);


-- =====================================================================
-- CONTENT: articles, comments, likes, saves, feed posts, ratings   (safe to re-run)
-- Everything below replaces the old demo data. All rows belong to a user (users.user_id).
-- =====================================================================

-- ---- articles (table created above): extra columns + indexes ----
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_once BOOLEAN NOT NULL DEFAULT FALSE;   -- true after the first publish
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_title_len;
ALTER TABLE articles ADD CONSTRAINT articles_title_len CHECK (char_length(btrim(title)) >= 3);
CREATE INDEX IF NOT EXISTS articles_author_status_idx ON articles (author_id, status, updated_at DESC);

-- ---- article saves (bookmarks): "Save" button on an article ----
CREATE TABLE IF NOT EXISTS article_saves (
    user_id    BIGINT NOT NULL REFERENCES users(user_id)       ON DELETE CASCADE,
    article_id BIGINT NOT NULL REFERENCES articles(article_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS article_saves_recent_idx ON article_saves (user_id, created_at DESC);

-- ---- feed posts (the /feed page). Replies to a post are rows in `comments` with target_type = 'post' ----
CREATE TABLE IF NOT EXISTS posts (
    post_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    body       VARCHAR(280) NOT NULL CHECK (char_length(btrim(body)) >= 1),
    match_id   INT,                                       -- optional tagged match (fixtures.event_id, no FK)
    edited_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_recent_idx ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_idx   ON posts (user_id, created_at DESC);

-- ---- comments: ONE table for every kind of thing that can be commented on ----
--   target_type 'match'   -> target_id = fixtures.event_id  (no FK: same reason as user_matches)
--   target_type 'article' -> target_id = articles.article_id
--   target_type 'review'  -> target_id = reviews.review_id
--   target_type 'post'    -> target_id = posts.post_id
--   parent_id = the comment this one replies to (NULL = top level)
CREATE TABLE IF NOT EXISTS comments (
    comment_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('match', 'article', 'review', 'post')),
    target_id   BIGINT NOT NULL,
    parent_id   BIGINT REFERENCES comments(comment_id) ON DELETE CASCADE,
    body        TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
    edited_at   TIMESTAMPTZ,                              -- set when the author edits it ("edited" label)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_target_idx ON comments (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_user_idx   ON comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments (parent_id);

-- ---- likes: ONE table for articles, comments, posts and reviews (a match "like" is user_matches.kind = 'liked') ----
CREATE TABLE IF NOT EXISTS likes (
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('article', 'comment', 'review', 'post')),
    target_id   BIGINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, target_type, target_id)         -- one like per user per thing
);
CREATE INDEX IF NOT EXISTS likes_target_idx ON likes (target_type, target_id);

-- ---- 1-10 rating of a match (the rating bars on the match page) ----
CREATE TABLE IF NOT EXISTS match_ratings (
    user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    match_id   INT NOT NULL,
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, match_id)
);
CREATE INDEX IF NOT EXISTS match_ratings_match_idx ON match_ratings (match_id);

DROP TRIGGER IF EXISTS comments_set_updated_at ON comments;
CREATE TRIGGER comments_set_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS posts_set_updated_at ON posts;
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- comments and likes point at several tables, so no foreign key can cascade for them: this trigger does it.
-- TG_ARGV[0] = target type, TG_ARGV[1] = name of the id column of the deleted row.
CREATE OR REPLACE FUNCTION delete_target_children() RETURNS trigger AS $$
DECLARE tid BIGINT := (to_jsonb(OLD) ->> TG_ARGV[1])::bigint;
BEGIN
  DELETE FROM likes    WHERE target_type = TG_ARGV[0] AND target_id = tid;
  IF TG_ARGV[0] <> 'comment' THEN
    DELETE FROM comments WHERE target_type = TG_ARGV[0] AND target_id = tid;   -- their own likes go via the comment trigger
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_cleanup ON articles;
CREATE TRIGGER articles_cleanup AFTER DELETE ON articles FOR EACH ROW EXECUTE FUNCTION delete_target_children('article', 'article_id');
DROP TRIGGER IF EXISTS posts_cleanup ON posts;
CREATE TRIGGER posts_cleanup    AFTER DELETE ON posts    FOR EACH ROW EXECUTE FUNCTION delete_target_children('post', 'post_id');
DROP TRIGGER IF EXISTS reviews_cleanup ON reviews;
CREATE TRIGGER reviews_cleanup  AFTER DELETE ON reviews  FOR EACH ROW EXECUTE FUNCTION delete_target_children('review', 'review_id');
DROP TRIGGER IF EXISTS comments_cleanup ON comments;
CREATE TRIGGER comments_cleanup AFTER DELETE ON comments FOR EACH ROW EXECUTE FUNCTION delete_target_children('comment', 'comment_id');

-- Activity tab: also show comments (replaces the old view, same columns)
CREATE OR REPLACE VIEW user_activity AS
    SELECT user_id, kind AS type, match_id, NULL::BIGINT AS target_user_id, NULL::BIGINT AS ref_id,
           NULL::TEXT AS title, NULL::SMALLINT AS rating, created_at
      FROM user_matches
    UNION ALL
    SELECT user_id, 'review', match_id, NULL, review_id, title, rating, created_at FROM reviews
    UNION ALL
    SELECT follower_id, 'follow', NULL, followee_id, NULL, NULL, NULL, created_at FROM follows
    UNION ALL
    SELECT author_id, 'article', NULL, NULL, article_id, title, NULL, published_at
      FROM articles WHERE status = 'published'
    UNION ALL
    SELECT user_id, 'comment', CASE WHEN target_type = 'match' THEN target_id::int END, NULL, comment_id,
           left(body, 140), NULL, created_at
      FROM comments;


-- =====================================================================
-- FEED v2: posts with pictures (Twitter-style)   (safe to re-run)
-- =====================================================================
-- A post may now be pictures only, so the "body has at least one character" rule moves into the API (text OR at least one picture).
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_body_check;

-- Up to 4 pictures per post. The browser resizes them (max 1600 px, JPEG) and the bytes are stored here;
-- GET /api/post-images/:id serves them with a long cache header (a picture never changes once saved).
CREATE TABLE IF NOT EXISTS post_images (
    image_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id    BIGINT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    position   SMALLINT NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 3),
    mime       VARCHAR(20) NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
    width      INT CHECK (width  IS NULL OR width  BETWEEN 1 AND 8192),
    height     INT CHECK (height IS NULL OR height BETWEEN 1 AND 8192),
    alt        VARCHAR(200),                              -- picture description for screen readers
    data       BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, position)
);


-- =====================================================================
-- SEARCH: typo-tolerant matching for people, articles and posts   (safe to re-run)
-- =====================================================================
-- pg_trgm gives "did you mean" style fuzzy matching ("bellingam" finds "Bellingham"). It ships with Postgres and Neon, but if your host
-- does not allow it the search still works (exact / prefix / word-start / contains matching), it just is not typo tolerant.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm is not available (%): search will not tolerate typos', SQLERRM;
END $$;
