SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE community_cards (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submission_key uuid NOT NULL,
    payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
    kind text NOT NULL CHECK (kind IN ('request','poll')),
    title text NOT NULL CHECK (char_length(title) BETWEEN 10 AND 180),
    body text NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
    country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    locality text NOT NULL CHECK (char_length(locality) BETWEEN 2 AND 120),
    closes_at timestamptz NOT NULL,
    rules_version text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hidden')),
    reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_id,submission_key),
    CHECK (closes_at > created_at),
    CHECK (reviewed_by IS NULL OR reviewed_by <> owner_id)
);
CREATE INDEX community_cards_feed ON community_cards(status,created_at DESC,id DESC);
CREATE INDEX community_cards_owner ON community_cards(owner_id,created_at DESC,id DESC);
REVOKE ALL ON community_cards FROM PUBLIC;
CREATE TABLE community_responses (
    card_id uuid NOT NULL REFERENCES community_cards(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    choice text NOT NULL CHECK (choice IN ('yes','no','dont_know')),
    rules_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(card_id,user_id)
);
CREATE INDEX community_responses_user ON community_responses(user_id,card_id);
REVOKE ALL ON community_responses FROM PUBLIC;
CREATE TABLE community_opinions (
    id uuid PRIMARY KEY,
    card_id uuid NOT NULL REFERENCES community_cards(id) ON DELETE RESTRICT,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submission_key uuid NOT NULL,
    payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
    text text NOT NULL CHECK (char_length(text) BETWEEN 10 AND 1000),
    rules_version text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hidden')),
    reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_id,submission_key),
    CHECK (reviewed_by IS NULL OR reviewed_by<>owner_id)
);
CREATE INDEX community_opinions_card ON community_opinions(card_id,status,id DESC);
CREATE INDEX community_opinions_owner ON community_opinions(owner_id,id DESC);
CREATE INDEX community_opinions_daily ON community_opinions(owner_id,created_at DESC);
CREATE TABLE community_flags (
    id uuid PRIMARY KEY,
    card_id uuid NOT NULL REFERENCES community_cards(id) ON DELETE RESTRICT,
    reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason text NOT NULL CHECK (reason IN ('privacy','harassment','misleading','other')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(card_id,reporter_id)
);
CREATE INDEX community_flags_reporter ON community_flags(reporter_id);
REVOKE ALL ON community_opinions,community_flags FROM PUBLIC;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='civiclens_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON community_cards TO civiclens_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON community_responses TO civiclens_runtime;
    GRANT SELECT,INSERT,UPDATE ON community_opinions TO civiclens_runtime;
    GRANT SELECT,INSERT ON community_flags TO civiclens_runtime;
END IF;
END $$;
