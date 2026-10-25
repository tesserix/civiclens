SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE UNIQUE INDEX reports_id_owner ON reports(id,owner_id);

CREATE TABLE official_complaint_requests (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    report_id uuid NOT NULL,
    submission_key uuid NOT NULL,
    payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
    status text NOT NULL DEFAULT 'blocked' CHECK (status='blocked'),
    resolution jsonb NOT NULL CHECK ((resolution->>'canSubmit'='false') IS TRUE),
    rules_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (report_id,owner_id) REFERENCES reports(id,owner_id) ON DELETE RESTRICT,
    UNIQUE(owner_id,submission_key)
);
CREATE INDEX official_complaint_requests_report ON official_complaint_requests(owner_id,report_id,id DESC);
CREATE INDEX official_complaint_requests_quota ON official_complaint_requests(owner_id,created_at DESC);
REVOKE ALL ON official_complaint_requests FROM PUBLIC;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='civiclens_runtime') THEN
    GRANT SELECT,INSERT ON official_complaint_requests TO civiclens_runtime;
END IF;
END $$;
