SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE community_cards ADD COLUMN topic text NOT NULL DEFAULT 'general'
    CHECK (topic IN ('general','environment','transport','public_safety','governance','other'));
CREATE INDEX community_cards_topic_deadline ON community_cards(status,topic,closes_at,id DESC);
CREATE INDEX community_cards_deadline ON community_cards(status,closes_at,id DESC);
CREATE INDEX community_cards_search ON community_cards USING gin
    (to_tsvector('simple',title || ' ' || body || ' ' || locality));

CREATE TABLE community_watches (
    card_id uuid NOT NULL REFERENCES community_cards(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(card_id,user_id)
);
CREATE INDEX community_watches_user ON community_watches(user_id,card_id);
REVOKE ALL ON community_watches FROM PUBLIC;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='civiclens_runtime') THEN
    GRANT SELECT,INSERT,DELETE ON community_watches TO civiclens_runtime;
END IF;
END $$;
