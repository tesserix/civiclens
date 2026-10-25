SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE authority_directory_records DROP CONSTRAINT authority_directory_records_kind_check;
ALTER TABLE authority_directory_records ADD CONSTRAINT authority_directory_records_kind_check
    CHECK (kind IN ('statistical_area','organisation','role','officeholder','service_directory','verified_authority','administrative_unit'));

ALTER TABLE authority_directory_records
    ADD COLUMN country_code text GENERATED ALWAYS AS (payload->>'countryCode') STORED,
    ADD COLUMN administrative_level text GENERATED ALWAYS AS (payload#>>'{details,adminLevel}') STORED,
    ADD COLUMN parent_record_id text GENERATED ALWAYS AS (payload#>>'{details,parentId}') STORED,
    ADD COLUMN complaint_api_status text GENERATED ALWAYS AS (coalesce(payload#>>'{details,complaintApiStatus}','unknown')) STORED;

ALTER TABLE authority_directory_records ADD CONSTRAINT authority_directory_complaint_api_status
    CHECK (complaint_api_status IN ('unknown','documented','not_offered'));
CREATE INDEX authority_directory_records_country_level ON authority_directory_records(country_code,administrative_level,import_id,record_id);
CREATE INDEX authority_directory_records_parent ON authority_directory_records(country_code,parent_record_id,import_id,record_id);

CREATE OR REPLACE VIEW current_authority_directory AS
WITH latest AS (
    SELECT DISTINCT ON (source_id) id,source_id,source_kind,retrieved_at
    FROM authority_directory_imports
    ORDER BY source_id,retrieved_at DESC,created_at DESC,id DESC
)
SELECT i.source_id,i.source_kind,i.retrieved_at,r.import_id,r.record_id,
       r.kind,r.name,r.region_code,r.payload,
       r.country_code,r.administrative_level,r.parent_record_id,r.complaint_api_status
FROM latest i JOIN authority_directory_records r ON r.import_id=i.id;
