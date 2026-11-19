-- =====================================================================
-- Connecting `fixtures` and `fixture_events`
-- The link is  fixtures.event_id = fixture_events.event_id  (both varchar; ESPN's event id).
-- team_side = 'home' / 'away' says which of the fixture's two teams the event belongs to.
-- =====================================================================

-- 0. One-time: speed up the join (a plain index, NOT unique: old FBref-era rows may repeat event_ids across seasons)
CREATE INDEX IF NOT EXISTS fixtures_event_id_idx       ON fixtures       (event_id);
CREATE INDEX IF NOT EXISTS fixture_events_event_id_idx ON fixture_events (event_id);

-- 1. Timeline of ONE match, with team names (replace the id)
SELECT f.event_id,
       f.home_team_name || ' ' || f.home_team_score || '-' || f.away_team_score || ' ' || f.away_team_name AS match,
       e.minute,
       e.event_type,
       CASE e.team_side WHEN 'home' THEN f.home_team_name ELSE f.away_team_name END AS team,
       e.player,
       e.assist
FROM fixtures f
JOIN fixture_events e ON e.event_id = f.event_id
WHERE f.event_id = '123456'
ORDER BY (regexp_match(e.minute, '^\d+'))[1]::int,
         COALESCE((regexp_match(e.minute, '\+(\d+)'))[1]::int, 0);

-- 2. Every match with its events; matches without events still appear (LEFT JOIN)
SELECT f.event_id, f.date, f.home_team_name, f.home_team_score, f.away_team_score, f.away_team_name,
       e.minute, e.event_type, e.team_side, e.player, e.assist
FROM fixtures f
LEFT JOIN fixture_events e ON e.event_id = f.event_id
WHERE f.season_type = '2026/27' AND f.league_id = '9'
ORDER BY f.date, f.event_id,
         (regexp_match(e.minute, '^\d+'))[1]::int NULLS LAST;

-- 3. Reusable view: one row per event, with match + team context
CREATE OR REPLACE VIEW fixture_events_full AS
SELECT e.event_id, f.league_id, f.season_type, f.date,
       f.home_team_id, f.home_team_name, f.away_team_id, f.away_team_name,
       f.home_team_score, f.away_team_score,
       e.team_side, e.minute, e.event_type, e.player, e.assist,
       CASE e.team_side WHEN 'home' THEN f.home_team_id   ELSE f.away_team_id   END AS team_id,
       CASE e.team_side WHEN 'home' THEN f.home_team_name ELSE f.away_team_name END AS team_name
FROM fixture_events e
JOIN fixtures f ON f.event_id = e.event_id;
-- usage:  SELECT * FROM fixture_events_full WHERE team_name = 'Arsenal' AND event_type = 'red_card';

-- 4. Top scorers of a league + season (own goals excluded)
SELECT player, team_name, count(*) AS goals,
       count(*) FILTER (WHERE event_type = 'penalty_goal') AS penalties
FROM fixture_events_full
WHERE league_id = '9' AND season_type = '2026/27' AND event_type IN ('goal', 'penalty_goal') AND player IS NOT NULL
GROUP BY player, team_name
ORDER BY goals DESC, player
LIMIT 20;

-- 5. Top assisters
SELECT assist AS player, team_name, count(*) AS assists
FROM fixture_events_full
WHERE league_id = '9' AND season_type = '2026/27' AND assist IS NOT NULL
GROUP BY assist, team_name
ORDER BY assists DESC
LIMIT 20;

-- 6. Cards per team
SELECT team_name,
       count(*) FILTER (WHERE event_type = 'yellow_card')   AS yellows,
       count(*) FILTER (WHERE event_type = 'second_yellow') AS second_yellows,
       count(*) FILTER (WHERE event_type = 'red_card')      AS reds
FROM fixture_events_full
WHERE league_id = '9' AND season_type = '2026/27'
GROUP BY team_name
ORDER BY reds DESC, yellows DESC;

-- 7. Data check: finished matches whose goal events do not add up to the score
--    (also lists finished matches that have no events at all)
SELECT f.event_id, f.date, f.home_team_name, f.away_team_name,
       f.home_team_score::int + f.away_team_score::int AS score_total,
       count(e.event_id) FILTER (WHERE e.event_type IN ('goal', 'penalty_goal', 'own_goal')) AS goal_events
FROM fixtures f
LEFT JOIN fixture_events e ON e.event_id = f.event_id
WHERE f.status_id IN ('28', '45', '46', '47')
GROUP BY f.event_id, f.date, f.home_team_name, f.away_team_name, f.home_team_score, f.away_team_score
HAVING f.home_team_score::int + f.away_team_score::int
       <> count(e.event_id) FILTER (WHERE e.event_type IN ('goal', 'penalty_goal', 'own_goal'))
ORDER BY f.date DESC;

-- 8. Clean up events whose match no longer exists in fixtures
DELETE FROM fixture_events e
WHERE NOT EXISTS (SELECT 1 FROM fixtures f WHERE f.event_id = e.event_id);
