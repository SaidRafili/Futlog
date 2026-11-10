-- Run once on your database (Neon / Supabase / psql).
CREATE TABLE IF NOT EXISTS article_images (
  image_id     bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id      bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content_type varchar(30) NOT NULL,
  size_bytes   integer NOT NULL CHECK (size_bytes > 0),
  data         bytea NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_images_user_idx ON article_images (user_id, created_at);
