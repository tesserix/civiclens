SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE authority_directory_imports (
    id uuid PRIMARY KEY,
    source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 120),
    source_kind text NOT NULL CHECK (source_kind IN ('reference', 'reviewed')),
    source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
    licence_url text NOT NULL CHECK (licence_url LIKE 'https://%'),
    attribution text NOT NULL CHECK (length(attribution) BETWEEN 1 AND 2000),
    retrieved_at timestamptz NOT NULL,
    upstream_sha256 text NOT NULL CHECK (upstream_sha256 ~ '^[a-fA-F0-9]{64}$'),
    snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
    record_count integer NOT NULL CHECK (record_count BETWEEN 0 AND 20000),
    created_at timestamptz NOT NULL DEFAULT now(),
    database_principal text NOT NULL DEFAULT current_user,
    UNIQUE (source_id, snapshot_sha256),
    UNIQUE (id, source_kind),
    CHECK ((source_kind = 'reviewed') = (source_id = 'civiclens-reviewed-authorities'))
);
CREATE INDEX authority_directory_imports_latest ON authority_directory_imports(source_id, retrieved_at DESC, created_at DESC, id DESC);

CREATE TABLE authority_directory_records (
    import_id uuid NOT NULL,
    source_kind text NOT NULL,
    record_id text NOT NULL CHECK (length(record_id) BETWEEN 1 AND 120),
    kind text NOT NULL CHECK (kind IN ('statistical_area','organisation','role','officeholder','service_directory','verified_authority')),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 2000),
    region_code text,
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (import_id, record_id),
    FOREIGN KEY (import_id, source_kind) REFERENCES authority_directory_imports(id, source_kind) ON DELETE RESTRICT,
    CHECK ((kind = 'verified_authority') = (source_kind = 'reviewed')),
    CHECK (source_kind = 'reviewed' OR coalesce(payload->>'verificationStatus' = 'reference', false)),
    CHECK (coalesce(payload->>'countryCode' ~ '^[A-Z]{2}$', false))
);
CREATE INDEX authority_directory_records_kind ON authority_directory_records(kind, import_id);

CREATE VIEW current_authority_directory AS
WITH latest AS (
    SELECT DISTINCT ON (source_id) id, source_id, source_kind, retrieved_at
    FROM authority_directory_imports
    ORDER BY source_id, retrieved_at DESC, created_at DESC, id DESC
)
SELECT i.source_id, i.source_kind, i.retrieved_at, r.import_id, r.record_id,
       r.kind, r.name, r.region_code, r.payload
FROM latest i JOIN authority_directory_records r ON r.import_id = i.id;

CREATE FUNCTION reject_authority_directory_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'authority directory history is append only'; END; $$;
CREATE TRIGGER authority_directory_imports_immutable BEFORE UPDATE OR DELETE ON authority_directory_imports
FOR EACH ROW EXECUTE FUNCTION reject_authority_directory_mutation();
CREATE TRIGGER authority_directory_records_immutable BEFORE UPDATE OR DELETE ON authority_directory_records
FOR EACH ROW EXECUTE FUNCTION reject_authority_directory_mutation();

REVOKE ALL ON authority_directory_imports, authority_directory_records, current_authority_directory FROM PUBLIC;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civiclens_runtime') THEN
    GRANT SELECT ON authority_directory_imports, authority_directory_records, current_authority_directory TO civiclens_runtime;
END IF;
END $$;
