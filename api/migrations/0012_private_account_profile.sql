SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TABLE users
  ADD COLUMN profile_bio text NOT NULL DEFAULT '' CHECK (char_length(profile_bio) <= 280),
  ADD COLUMN avatar_jpeg bytea CHECK (octet_length(avatar_jpeg) BETWEEN 1 AND 98304),
  ADD COLUMN sign_in_photo_url text CHECK (char_length(sign_in_photo_url) <= 2048);
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civiclens_runtime') THEN
  GRANT UPDATE (profile_bio, avatar_jpeg, sign_in_photo_url, updated_at) ON users TO civiclens_runtime;
END IF;
END $$;
