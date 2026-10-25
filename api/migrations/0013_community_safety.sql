SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE community_user_blocks (
    blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (blocker_id, blocked_user_id),
    CHECK (blocker_id <> blocked_user_id)
);
CREATE INDEX community_user_blocks_target ON community_user_blocks(blocked_user_id, blocker_id);
REVOKE ALL ON community_user_blocks FROM PUBLIC;

CREATE TABLE community_opinion_flags (
    id uuid PRIMARY KEY,
    opinion_id uuid NOT NULL REFERENCES community_opinions(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason text NOT NULL CHECK (reason IN ('privacy','harassment','misleading','other')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (opinion_id, reporter_id)
);
CREATE INDEX community_opinion_flags_reporter ON community_opinion_flags(reporter_id, id);
REVOKE ALL ON community_opinion_flags FROM PUBLIC;

CREATE FUNCTION community_users_visible(viewer uuid, author uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM community_user_blocks
        WHERE (blocker_id = viewer AND blocked_user_id = author)
           OR (blocker_id = author AND blocked_user_id = viewer)
    )
$$;
REVOKE ALL ON FUNCTION community_users_visible(uuid, uuid) FROM PUBLIC;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civiclens_runtime') THEN
    GRANT SELECT, INSERT, DELETE ON community_user_blocks TO civiclens_runtime;
    GRANT SELECT, INSERT ON community_opinion_flags TO civiclens_runtime;
    GRANT EXECUTE ON FUNCTION community_users_visible(uuid, uuid) TO civiclens_runtime;
END IF;
END $$;
