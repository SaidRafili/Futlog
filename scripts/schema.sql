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
