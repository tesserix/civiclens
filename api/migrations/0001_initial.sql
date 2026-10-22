CREATE TABLE users (
    id uuid PRIMARY KEY,
    identity_hash text NOT NULL UNIQUE,
    nickname text NOT NULL CHECK (length(nickname) BETWEEN 3 AND 30),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_nickname_unique ON users(lower(nickname));
CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('moderator', 'operator')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
);
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_challenges (
    id uuid PRIMARY KEY,
    nonce text NOT NULL,
    provider text NOT NULL CHECK (provider IN ('google', 'facebook')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_expiry ON auth_challenges(expires_at);
CREATE TABLE reports (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    idempotency_key uuid NOT NULL,
    payload_hash text NOT NULL,
    report jsonb NOT NULL,
    photo bytea NOT NULL CHECK (octet_length(photo) BETWEEN 1 AND 6000000),
    approval jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_id, idempotency_key)
);
CREATE INDEX reports_owner_page ON reports(owner_id, id DESC);
CREATE TABLE publications (
    id uuid PRIMARY KEY,
    report_id uuid NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
    channel text NOT NULL CHECK (channel IN ('facebook', 'instagram', 'whatsapp')),
    status text NOT NULL CHECK (status IN ('queued', 'sending', 'published', 'blocked', 'failed', 'uncertain')),
    provider_id text,
    reason text,
    caption text NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (report_id, channel)
);
CREATE INDEX publications_pending ON publications(next_attempt_at) WHERE status = 'queued';
CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
    action text NOT NULL,
    report_id uuid REFERENCES reports(id) ON DELETE RESTRICT,
    details jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_report ON audit_events(report_id, created_at DESC);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit events are append only'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
