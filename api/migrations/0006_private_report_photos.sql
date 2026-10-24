SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE report_photos (
    report_id uuid NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
    position smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
    bucket text NOT NULL CHECK (bucket LIKE 'civiclens-%' AND length(bucket) <= 63),
    object_name text NOT NULL CHECK (object_name ~ '^reports/[a-f0-9-]+/[a-f0-9-]+/[a-f0-9]{64}/[0-4]\.jpg$'),
    object_generation text NOT NULL CHECK (object_generation ~ '^[0-9]{1,20}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (report_id, position),
    UNIQUE (bucket, object_name, object_generation)
);
REVOKE ALL ON report_photos FROM PUBLIC;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civiclens_runtime') THEN
    GRANT SELECT, INSERT ON report_photos TO civiclens_runtime;
END IF;
END $$;
