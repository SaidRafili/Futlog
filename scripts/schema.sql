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
