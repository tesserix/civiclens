SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE complaint_channels (
    id text PRIMARY KEY,
    authority_id text NOT NULL,
    country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    category text NOT NULL CHECK (category IN ('waste','pollution','roads','water','public_safety')),
    name text NOT NULL,
    official_url text NOT NULL CHECK (official_url LIKE 'https://%'),
    evidence_url text NOT NULL CHECK (evidence_url LIKE 'https://%'),
    channel_type text NOT NULL CHECK (channel_type IN ('official_form','contact_page')),
    api_status text NOT NULL DEFAULT 'unknown' CHECK (api_status IN ('unknown','documented','not_offered')),
    authentication text NOT NULL,
    verified_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at>verified_at),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX complaint_channels_authority ON complaint_channels(authority_id,country_code,category);
REVOKE ALL ON complaint_channels FROM PUBLIC;

INSERT INTO complaint_channels(id,authority_id,country_code,category,name,official_url,evidence_url,channel_type,authentication,verified_at,expires_at)
VALUES ('au-vic-melbourne-cleaning','au-vic-melbourne','AU','waste','City of Melbourne — clean public space',
'https://services.melbourne.vic.gov.au/report/cleanpublicspace',
'https://www.melbourne.vic.gov.au/street-cleaning-and-maintenance','official_form',
'Complete the official form and supply any contact details it requests. CivicLens does not sign in or submit for you.',
'2026-10-24T16:40:00Z','2026-11-23T16:40:00Z');

CREATE TABLE complaint_intents (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    report_id uuid NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
    submission_key uuid NOT NULL,
    payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
    channel_id text NOT NULL REFERENCES complaint_channels(id) ON DELETE RESTRICT,
    status text NOT NULL CHECK (status IN ('prepared','handoff_requested')),
    package jsonb NOT NULL,
    rules_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_id,submission_key),
    UNIQUE(owner_id,report_id,channel_id)
);
CREATE INDEX complaint_intents_report ON complaint_intents(report_id);
CREATE INDEX complaint_intents_channel ON complaint_intents(channel_id);
REVOKE ALL ON complaint_intents FROM PUBLIC;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='civiclens_runtime') THEN
    GRANT SELECT ON complaint_channels TO civiclens_runtime;
    GRANT SELECT,INSERT,UPDATE ON complaint_intents TO civiclens_runtime;
END IF;
END $$;
