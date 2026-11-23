-- =====================================================================
-- BACKLINKS  (tracks every external page that links to a Futlog page)
-- Run once:  npm run db:backlinks      (safe to re-run)
-- Needs the set_updated_at() function that scripts/schema.sql creates.
-- =====================================================================
CREATE TABLE IF NOT EXISTS backlinks (
    backlink_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- WHERE the link lives (the other website) -----------------------
    source_url      TEXT NOT NULL,                       -- full URL of the page that contains the link
    source_domain   TEXT GENERATED ALWAYS AS (           -- filled automatically: "example.com" (no www.)
                      lower(substring(source_url from '^https?://(?:www\.)?([^/:?#]+)'))
                    ) STORED,

    -- WHAT it points to (a Futlog page) ------------------------------
    target_url      TEXT NOT NULL,                       -- e.g. https://futlog.com/article/12
    anchor_text     TEXT,                                -- the clickable words ("Futlog", "click here", NULL for image links)

    -- QUALITY signals -------------------------------------------------
    link_type       VARCHAR(10) NOT NULL DEFAULT 'dofollow'
                      CHECK (link_type IN ('dofollow', 'nofollow', 'ugc', 'sponsored')),
    domain_rating   SMALLINT CHECK (domain_rating BETWEEN 0 AND 100),   -- DA / DR from Moz, Ahrefs, Semrush (optional)
    source_type     VARCHAR(20) NOT NULL DEFAULT 'other'
                      CHECK (source_type IN ('blog', 'news', 'forum', 'social', 'directory', 'guest_post', 'partner', 'other')),

    -- LIFECYCLE -------------------------------------------------------
    status          VARCHAR(10) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'lost', 'broken')),
                      -- pending = outreach / not verified yet, active = link found on the page,
                      -- lost = page loads but the link is gone, broken = the source page errors (404 / 5xx)
    http_status     SMALLINT,                            -- last HTTP code of source_url
    first_seen_at   TIMESTAMPTZ,                         -- when the link was first confirmed live
    last_checked_at TIMESTAMPTZ,                         -- last time you (or the checker script) verified it
    lost_at         TIMESTAMPTZ,                         -- when it stopped being active
    acquired_via    VARCHAR(100),                        -- "outreach", "guest post", "organic", "press" ...
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT backlinks_source_is_url CHECK (source_url ~* '^https?://'),
    CONSTRAINT backlinks_target_is_url CHECK (target_url ~* '^https?://'),
    CONSTRAINT backlinks_unique_link   UNIQUE (source_url, target_url)   -- the same link is only stored once
);

CREATE INDEX IF NOT EXISTS backlinks_target_idx  ON backlinks (target_url);
CREATE INDEX IF NOT EXISTS backlinks_domain_idx  ON backlinks (source_domain);
CREATE INDEX IF NOT EXISTS backlinks_status_idx  ON backlinks (status, last_checked_at);

DROP TRIGGER IF EXISTS backlinks_set_updated_at ON backlinks;
CREATE TRIGGER backlinks_set_updated_at BEFORE UPDATE ON backlinks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
