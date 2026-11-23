-- =====================================================================
-- Backlink tracking: ready-made queries for the `backlinks` table.
-- Run them in the Neon SQL editor (or psql). Replace anything in <angle brackets> or 'example.com'.
-- =====================================================================

-- 1. ADD a backlink (re-running it updates the existing row instead of failing)
INSERT INTO backlinks (source_url, target_url, anchor_text, link_type, domain_rating, source_type, status, first_seen_at, last_checked_at, acquired_via, notes)
VALUES ('https://www.example.com/best-football-apps', 'https://futlog.com/', 'Futlog', 'dofollow', 54, 'blog', 'active', now(), now(), 'outreach', 'Mentioned in a roundup')
ON CONFLICT (source_url, target_url) DO UPDATE
   SET anchor_text = EXCLUDED.anchor_text, link_type = EXCLUDED.link_type, domain_rating = EXCLUDED.domain_rating,
       status = EXCLUDED.status, last_checked_at = now();

-- 2. ADD several at once
INSERT INTO backlinks (source_url, target_url, anchor_text, link_type, source_type, status) VALUES
  ('https://reddit.com/r/soccer/comments/abc123', 'https://futlog.com/matches', 'Futlog',          'ugc',      'forum',     'pending'),
  ('https://footyblog.net/tools',                 'https://futlog.com/',        'match diary app', 'dofollow', 'blog',      'pending'),
  ('https://directory.example.org/sports',        'https://futlog.com/',        'Futlog',          'nofollow', 'directory', 'pending')
ON CONFLICT (source_url, target_url) DO NOTHING;

-- 3. LIST everything, newest first
SELECT backlink_id, source_domain, source_url, target_url, anchor_text, link_type, domain_rating, status, first_seen_at
FROM backlinks
ORDER BY created_at DESC;

-- 4. DASHBOARD: the headline numbers
SELECT count(*)                                         AS total_links,
       count(*) FILTER (WHERE status = 'active')        AS active,
       count(*) FILTER (WHERE status = 'pending')       AS pending,
       count(*) FILTER (WHERE status IN ('lost','broken')) AS lost_or_broken,
       count(DISTINCT source_domain) FILTER (WHERE status = 'active') AS referring_domains,
       count(*) FILTER (WHERE status = 'active' AND link_type = 'dofollow') AS dofollow_active,
       round(avg(domain_rating) FILTER (WHERE status = 'active'), 1)       AS avg_domain_rating
FROM backlinks;

-- 5. Active links per referring DOMAIN (search engines care about unique domains more than raw link count)
SELECT source_domain,
       count(*)                                  AS links,
       max(domain_rating)                        AS domain_rating,
       count(*) FILTER (WHERE link_type = 'dofollow') AS dofollow_links,
       min(first_seen_at)                        AS first_seen
FROM backlinks
WHERE status = 'active'
GROUP BY source_domain
ORDER BY domain_rating DESC NULLS LAST, links DESC;

-- 6. Which Futlog pages have the MOST backlinks (and which have none -> next targets)
SELECT target_url,
       count(*) FILTER (WHERE status = 'active')                          AS active_links,
       count(DISTINCT source_domain) FILTER (WHERE status = 'active')     AS referring_domains
FROM backlinks
GROUP BY target_url
ORDER BY referring_domains DESC, active_links DESC;

-- 7. ANCHOR TEXT distribution (too many identical exact-match anchors looks spammy)
SELECT coalesce(nullif(trim(anchor_text), ''), '(image / no text)') AS anchor,
       count(*) AS uses,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM backlinks
WHERE status = 'active'
GROUP BY 1
ORDER BY uses DESC;

-- 8. Dofollow vs nofollow vs ugc vs sponsored
SELECT link_type, count(*) AS links, count(DISTINCT source_domain) AS domains
FROM backlinks
WHERE status = 'active'
GROUP BY link_type
ORDER BY links DESC;

-- 9. New links per month (are you gaining momentum?)
SELECT date_trunc('month', first_seen_at)::date AS month, count(*) AS new_links, count(DISTINCT source_domain) AS new_domains
FROM backlinks
WHERE first_seen_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

-- 10. Links gained vs lost per month
SELECT m.month,
       count(*) FILTER (WHERE b.first_seen_at >= m.month AND b.first_seen_at < m.month + interval '1 month') AS gained,
       count(*) FILTER (WHERE b.lost_at       >= m.month AND b.lost_at       < m.month + interval '1 month') AS lost
FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS m(month)
CROSS JOIN backlinks b
GROUP BY m.month
ORDER BY m.month DESC;

-- 11. Outreach follow-up list: still pending after 14 days
SELECT backlink_id, source_url, target_url, acquired_via, created_at
FROM backlinks
WHERE status = 'pending' AND created_at < now() - interval '14 days'
ORDER BY created_at;

-- 12. Needs RE-CHECKING: active links not verified in the last 30 days (oldest first)
SELECT backlink_id, source_url, target_url, last_checked_at
FROM backlinks
WHERE status = 'active' AND (last_checked_at IS NULL OR last_checked_at < now() - interval '30 days')
ORDER BY last_checked_at NULLS FIRST
LIMIT 100;

-- 13. Mark a link as VERIFIED live
UPDATE backlinks
SET status = 'active', http_status = 200, last_checked_at = now(), first_seen_at = coalesce(first_seen_at, now()), lost_at = NULL
WHERE backlink_id = 1;                      -- or: WHERE source_url = '...' AND target_url = '...'

-- 14. Mark a link as LOST (page is up, link removed) or BROKEN (source page errors)
UPDATE backlinks SET status = 'lost',   last_checked_at = now(), lost_at = coalesce(lost_at, now()) WHERE backlink_id = 1;
UPDATE backlinks SET status = 'broken', http_status = 404, last_checked_at = now(), lost_at = coalesce(lost_at, now()) WHERE backlink_id = 2;

-- 15. RECENTLY LOST links worth an outreach email to win back
SELECT backlink_id, source_domain, source_url, domain_rating, lost_at
FROM backlinks
WHERE status IN ('lost', 'broken') AND lost_at > now() - interval '60 days'
ORDER BY domain_rating DESC NULLS LAST, lost_at DESC;

-- 16. Find backlinks from one domain (matches example.com and www.example.com)
SELECT * FROM backlinks WHERE source_domain = 'example.com';

-- 17. DELETE a backlink
DELETE FROM backlinks WHERE backlink_id = 1;
