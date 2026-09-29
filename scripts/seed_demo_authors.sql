-- Optional: the four demo authors from lib/demo.js
INSERT INTO users (handle, display_name, bio, is_author) VALUES
  ('saidrafili', 'Said Rafili', 'I am a football fan who is keen to analyze each segment of football based on 90 minutes of time we are left with', TRUE),
  ('nora.wells', 'Nora Wells', 'Writes about pressing, shape and the small details that decide matches.', TRUE),
  ('tomasreyes', 'Tomas Reyes', 'Covers youth football and the scouting stories behind tomorrow’s stars.', TRUE),
  ('anakowal',   'Ana Kowal',   'Tactics analyst. Believes every full-back deserves a heat map.', TRUE)
ON CONFLICT (handle) DO NOTHING;

-- Example article (author looked up by handle)
WITH a AS (
  INSERT INTO articles (author_id, title, category, read_minutes, body, status, published_at)
  SELECT user_id, 'How pressing traps are changing the Premier League', 'Tactics', 6,
         ARRAY['First paragraph…', 'Second paragraph…'], 'published', now()
  FROM users WHERE handle = 'nora.wells'
  RETURNING article_id
)
INSERT INTO article_matches (article_id, match_id) SELECT article_id, 1 FROM a;
