use crate::{authority, error::Error};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Postgres, QueryBuilder, Row};
use std::collections::HashSet;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

const REVIEWED_SOURCE: &str = "civiclens-reviewed-authorities";
const MAX_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Snapshot {
    source_id: String,
    source_url: String,
    licence_url: String,
    attribution: String,
    retrieved_at: String,
    upstream_sha256: String,
    records: Vec<ReferenceRecord>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReferenceRecord {
    id: String,
    kind: ReferenceKind,
    name: String,
    country_code: String,
    region_code: Option<String>,
    official_url: Option<String>,
    evidence_url: String,
    verification_status: String,
    details: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
enum ReferenceKind {
    StatisticalArea,
    Organisation,
    Role,
    Officeholder,
    ServiceDirectory,
}

impl ReferenceKind {
    fn as_str(&self) -> &'static str {
        match self {
            Self::StatisticalArea => "statistical_area",
            Self::Organisation => "organisation",
            Self::Role => "role",
            Self::Officeholder => "officeholder",
            Self::ServiceDirectory => "service_directory",
        }
    }
}

fn https(value: &str) -> bool {
    reqwest::Url::parse(value).is_ok_and(|url| {
        url.scheme() == "https"
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
    })
}

fn identity(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn invalid() -> Error {
    Error::Invalid("Authority source snapshot is invalid.")
}

fn parse_reference(bytes: &[u8]) -> Result<Snapshot, Error> {
    if bytes.len() > MAX_BYTES {
        return Err(invalid());
    }
    let snapshot: Snapshot = serde_json::from_slice(bytes).map_err(|_| invalid())?;
    let mut ids = HashSet::new();
    if !snapshot.source_id.starts_with("au-")
        || !identity(&snapshot.source_id)
        || !https(&snapshot.source_url)
        || !https(&snapshot.licence_url)
        || snapshot.attribution.trim().is_empty()
        || snapshot.attribution.len() > 2000
        || snapshot.records.len() > 20_000
        || snapshot.upstream_sha256.len() != 64
        || !snapshot
            .upstream_sha256
            .bytes()
            .all(|b| b.is_ascii_hexdigit())
        || OffsetDateTime::parse(&snapshot.retrieved_at, &Rfc3339).is_err()
    {
        return Err(invalid());
    }
    for r in &snapshot.records {
        if !identity(&r.id)
            || !ids.insert(&r.id)
            || r.name.trim().is_empty()
            || r.name.len() > 2000
            || r.name.chars().any(char::is_control)
            || r.country_code != "AU"
            || !https(&r.evidence_url)
            || r.official_url.as_ref().is_some_and(|u| !https(u))
            || r.region_code
                .as_ref()
                .is_some_and(|v| !v.starts_with("AU-") || v.len() > 20)
            || r.verification_status != "reference"
            || !r.details.is_object()
            || r.details.to_string().len() > 8192
        {
            return Err(invalid());
        }
    }
    Ok(snapshot)
}

struct StoredRecord {
    id: String,
    kind: &'static str,
    name: String,
    region: Option<String>,
    payload: serde_json::Value,
}

struct Source<'a> {
    id: &'a str,
    kind: &'a str,
    url: &'a str,
    licence: &'a str,
    attribution: &'a str,
    retrieved_at: OffsetDateTime,
    upstream_sha256: &'a str,
}

async fn store(
    pool: &PgPool,
    source: Source<'_>,
    bytes: &[u8],
    records: &[StoredRecord],
) -> Result<Uuid, Error> {
    if source.retrieved_at > OffsetDateTime::now_utc() + time::Duration::minutes(5) {
        return Err(invalid());
    }
    let snapshot_hash = hex::encode(Sha256::digest(bytes));
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(source.id)
        .execute(&mut *tx)
        .await?;
    if let Some(id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM authority_directory_imports WHERE source_id=$1 AND snapshot_sha256=$2",
    )
    .bind(source.id)
    .bind(&snapshot_hash)
    .fetch_optional(&mut *tx)
    .await?
    {
        tx.commit().await?;
        return Ok(id);
    }
    let latest: Option<OffsetDateTime> = sqlx::query_scalar(
        "SELECT max(retrieved_at) FROM authority_directory_imports WHERE source_id=$1",
    )
    .bind(source.id)
    .fetch_one(&mut *tx)
    .await?;
    if latest.is_some_and(|time| time > source.retrieved_at) {
        return Err(Error::Invalid(
            "An older source snapshot cannot replace newer data.",
        ));
    }
    let id = Uuid::now_v7();
    sqlx::query("INSERT INTO authority_directory_imports(id,source_id,source_kind,source_url,licence_url,attribution,retrieved_at,upstream_sha256,snapshot_sha256,record_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)")
        .bind(id).bind(source.id).bind(source.kind).bind(source.url).bind(source.licence).bind(source.attribution)
        .bind(source.retrieved_at).bind(source.upstream_sha256).bind(&snapshot_hash).bind(records.len() as i32).execute(&mut *tx).await?;
    for chunk in records.chunks(500) {
        let mut query = QueryBuilder::<Postgres>::new("INSERT INTO authority_directory_records(import_id,source_kind,record_id,kind,name,region_code,payload) ");
        query.push_values(chunk, |mut row, record| {
            row.push_bind(id)
                .push_bind(source.kind)
                .push_bind(&record.id)
                .push_bind(record.kind)
                .push_bind(&record.name)
                .push_bind(&record.region)
                .push_bind(&record.payload);
        });
        query.build().execute(&mut *tx).await?;
    }
    tx.commit().await?;
    tracing::info!(event="authority_directory_imported",source_id=source.id,records=records.len(),%id);
    Ok(id)
}

pub async fn import_reference(pool: &PgPool, bytes: &[u8]) -> Result<Uuid, Error> {
    let snapshot = parse_reference(bytes)?;
    let records: Vec<_> = snapshot
        .records
        .iter()
        .map(|r| {
            Ok(StoredRecord {
                id: r.id.clone(),
                kind: r.kind.as_str(),
                name: r.name.clone(),
                region: r.region_code.clone(),
                payload: serde_json::to_value(r).map_err(|_| invalid())?,
            })
        })
        .collect::<Result<_, Error>>()?;
    store(
        pool,
        Source {
            id: &snapshot.source_id,
            kind: "reference",
            url: &snapshot.source_url,
            licence: &snapshot.licence_url,
            attribution: &snapshot.attribution,
            retrieved_at: OffsetDateTime::parse(&snapshot.retrieved_at, &Rfc3339)
                .map_err(|_| invalid())?,
            upstream_sha256: &snapshot.upstream_sha256,
        },
        bytes,
        &records,
    )
    .await
}

pub async fn import_bundled(pool: &PgPool, root: &std::path::Path) -> Result<(), Error> {
    let mut paths = std::fs::read_dir(root.join("directory"))
        .map_err(|_| Error::Internal)?
        .map(|entry| entry.map(|e| e.path()).map_err(|_| Error::Internal))
        .collect::<Result<Vec<_>, _>>()?;
    paths.sort();
    for path in paths {
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let bytes = read_bounded(&path)?;
            import_reference(pool, &bytes).await?;
        }
    }
    let path = root.join("authorities.json");
    let bytes = read_bounded(&path)?;
    let authorities = authority::load(path.to_str().ok_or(Error::Internal)?)?;
    import_reviewed(pool, &bytes, &authorities).await?;
    Ok(())
}

pub fn read_bounded(path: &std::path::Path) -> Result<Vec<u8>, Error> {
    use std::io::Read;
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .map_err(|_| Error::Internal)?
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| Error::Internal)?;
    if bytes.len() > MAX_BYTES {
        return Err(invalid());
    }
    Ok(bytes)
}

async fn import_reviewed(
    pool: &PgPool,
    bytes: &[u8],
    authorities: &[authority::Authority],
) -> Result<Uuid, Error> {
    authority::validate(authorities)?;
    let records = authorities
        .iter()
        .map(|a| {
            Ok(StoredRecord {
                id: a.id.clone(),
                kind: "verified_authority",
                name: a.name.clone(),
                region: None,
                payload: serde_json::to_value(a).map_err(|_| invalid())?,
            })
        })
        .collect::<Result<Vec<_>, Error>>()?;
    let hash = hex::encode(Sha256::digest(bytes));
    store(
        pool,
        Source {
            id: REVIEWED_SOURCE,
            kind: "reviewed",
            url: "https://github.com/tesserix/civiclens/blob/main/api/data/authorities.json",
            licence: "https://creativecommons.org/licenses/by/4.0/",
            attribution:
                "CivicLens reviewed authority data; boundary attribution in api/data/NOTICE.md",
            retrieved_at: OffsetDateTime::now_utc(),
            upstream_sha256: &hash,
        },
        bytes,
        &records,
    )
    .await
}

pub async fn load_verified(pool: &PgPool) -> Result<Vec<authority::Authority>, Error> {
    let values: Vec<serde_json::Value> = sqlx::query_scalar("SELECT payload FROM current_authority_directory WHERE source_id=$1 AND kind='verified_authority' ORDER BY record_id")
        .bind(REVIEWED_SOURCE).fetch_all(pool).await?;
    let authorities = values
        .into_iter()
        .map(|value| serde_json::from_value(value).map_err(|_| invalid()))
        .collect::<Result<Vec<_>, Error>>()?;
    authority::validate(&authorities)?;
    Ok(authorities)
}

pub async fn status(pool: &PgPool) -> Result<serde_json::Value, Error> {
    let rows = sqlx::query("SELECT DISTINCT ON (i.source_id) i.id,i.source_id,i.source_kind,i.source_url,i.licence_url,i.retrieved_at,i.snapshot_sha256,i.upstream_sha256,i.record_count,i.database_principal,(SELECT count(*) FROM authority_directory_imports h WHERE h.source_id=i.source_id) AS versions FROM authority_directory_imports i ORDER BY i.source_id,i.retrieved_at DESC,i.created_at DESC,i.id DESC")
        .fetch_all(pool).await?;
    let mut sources = Vec::new();
    for row in rows {
        sources.push(serde_json::json!({"importId":row.try_get::<Uuid,_>("id")?,"sourceId":row.try_get::<String,_>("source_id")?,
            "sourceKind":row.try_get::<String,_>("source_kind")?,"sourceUrl":row.try_get::<String,_>("source_url")?,"licenceUrl":row.try_get::<String,_>("licence_url")?,
            "retrievedAt":row.try_get::<OffsetDateTime,_>("retrieved_at")?.format(&Rfc3339).map_err(|_| Error::Internal)?,
            "snapshotSha256":row.try_get::<String,_>("snapshot_sha256")?,"upstreamSha256":row.try_get::<String,_>("upstream_sha256")?,
            "recordCount":row.try_get::<i32,_>("record_count")?,"databasePrincipal":row.try_get::<String,_>("database_principal")?,"versions":row.try_get::<i64,_>("versions")?}));
    }
    let counts: Vec<(String, i64)> = sqlx::query_as(
        "SELECT kind,count(*) FROM current_authority_directory GROUP BY kind ORDER BY kind",
    )
    .fetch_all(pool)
    .await?;
    let regions = sqlx::query("SELECT region_code,count(*) FILTER (WHERE kind='statistical_area') AS areas,count(*) FILTER (WHERE kind='statistical_area' AND payload#>>'{details,specialArea}'='false') AS non_special,count(DISTINCT payload#>>'{details,absRecordId}') FILTER (WHERE kind='organisation') AS identities,count(DISTINCT payload#>>'{details,absRecordId}') FILTER (WHERE kind='role') AS leaders,count(*) FILTER (WHERE kind='service_directory') AS services FROM current_authority_directory WHERE region_code IS NOT NULL GROUP BY region_code ORDER BY region_code").fetch_all(pool).await?;
    let mut coverage = std::collections::BTreeMap::new();
    for row in regions {
        coverage.insert(row.try_get::<String,_>("region_code")?,serde_json::json!({
            "statisticalAreas":row.try_get::<i64,_>("areas")?,"nonSpecialAreas":row.try_get::<i64,_>("non_special")?,
            "councilIdentityCandidates":row.try_get::<i64,_>("identities")?,"leadershipCandidates":row.try_get::<i64,_>("leaders")?,"serviceDirectories":row.try_get::<i64,_>("services")?
        }));
    }
    Ok(
        serde_json::json!({"sources":sources,"recordsByKind":counts.into_iter().collect::<std::collections::BTreeMap<_,_>>(),"areaCoverage":coverage}),
    )
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

    fn reference() -> serde_json::Value {
        json!({"sourceId":"au-test", "sourceUrl":"https://official.gov.au/data", "licenceUrl":"https://creativecommons.org/licenses/by/4.0/", "attribution":"Official test data", "retrievedAt":"2026-10-24T00:00:00Z", "upstreamSha256":"a".repeat(64), "records":[{"id":"123", "kind":"statistical_area", "name":"Test area", "countryCode":"AU", "regionCode":"AU-VIC", "officialUrl":null, "evidenceUrl":"https://official.gov.au/area/123", "verificationStatus":"reference", "details":{"statisticalOnly":true}}]})
    }

    pub(crate) async fn assert_register_database_behaviour(pool: &PgPool) {
        let mut first = reference();
        first["retrievedAt"] = json!("2026-10-20T00:00:00Z");
        let bytes = serde_json::to_vec(&first).unwrap();
        let id = import_reference(pool, &bytes).await.unwrap();
        assert_eq!(import_reference(pool, &bytes).await.unwrap(), id);
        let (left, right) = tokio::join!(
            import_reference(pool, &bytes),
            import_reference(pool, &bytes)
        );
        assert_eq!(left.unwrap(), right.unwrap());
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM authority_directory_imports WHERE source_id='au-test'",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        assert_eq!(count, 1);
        assert!(load_verified(pool).await.unwrap().is_empty());

        let mut newer = first.clone();
        newer["retrievedAt"] = json!("2026-10-22T00:00:00Z");
        newer["records"][0]["name"] = json!("Updated test area");
        import_reference(pool, &serde_json::to_vec(&newer).unwrap())
            .await
            .unwrap();
        let name: String = sqlx::query_scalar(
            "SELECT name FROM current_authority_directory WHERE source_id='au-test'",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        assert_eq!(name, "Updated test area");
        let mut stale = first.clone();
        stale["records"][0]["name"] = json!("Stale replacement");
        assert!(import_reference(pool, &serde_json::to_vec(&stale).unwrap())
            .await
            .is_err());
        let original: String =
            sqlx::query_scalar("SELECT name FROM authority_directory_records WHERE import_id=$1")
                .bind(id)
                .fetch_one(pool)
                .await
                .unwrap();
        assert_eq!(original, "Test area");
        assert!(sqlx::query(
            "UPDATE authority_directory_records SET name='tampered' WHERE import_id=$1"
        )
        .bind(id)
        .execute(pool)
        .await
        .is_err());
        assert!(
            sqlx::query("DELETE FROM authority_directory_imports WHERE id=$1")
                .bind(id)
                .execute(pool)
                .await
                .is_err()
        );

        sqlx::raw_sql("CREATE FUNCTION reject_directory_test_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.record_id='fail-record' THEN RAISE EXCEPTION 'test rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_directory_test_record BEFORE INSERT ON authority_directory_records FOR EACH ROW EXECUTE FUNCTION reject_directory_test_record();").execute(pool).await.unwrap();
        let mut failed = first.clone();
        failed["sourceId"] = json!("au-failure");
        failed["records"][0]["id"] = json!("fail-record");
        assert!(
            import_reference(pool, &serde_json::to_vec(&failed).unwrap())
                .await
                .is_err()
        );
        let failed_count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM authority_directory_imports WHERE source_id='au-failure'",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        assert_eq!(
            failed_count, 0,
            "failed record insertion must roll back its import version"
        );
        sqlx::query("DROP TRIGGER reject_directory_test_record ON authority_directory_records")
            .execute(pool)
            .await
            .unwrap();

        let mut withdrawn = newer.clone();
        withdrawn["retrievedAt"] = json!("2026-10-23T00:00:00Z");
        withdrawn["records"] = json!([]);
        import_reference(pool, &serde_json::to_vec(&withdrawn).unwrap())
            .await
            .unwrap();
        let current: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM current_authority_directory WHERE source_id='au-test'",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        assert_eq!(current, 0);
        let report = status(pool).await.unwrap();
        let source = report["sources"]
            .as_array()
            .unwrap()
            .iter()
            .find(|s| s["sourceId"] == "au-test")
            .unwrap();
        assert_eq!(source["recordCount"], 0);
        assert_eq!(source["versions"], 3);
        let principal: String = sqlx::query_scalar("SELECT current_user")
            .fetch_one(pool)
            .await
            .unwrap();
        assert_eq!(source["databasePrincipal"], principal);

        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/data/authorities.json");
        let reviewed = authority::load(path).unwrap();
        import_reviewed(pool, &std::fs::read(path).unwrap(), &reviewed)
            .await
            .unwrap();
        assert_eq!(load_verified(pool).await.unwrap()[0].id, "au-vic-melbourne");
        for (table, privilege, expected) in [
            ("current_authority_directory", "SELECT", true),
            ("authority_directory_imports", "INSERT", false),
            ("authority_directory_records", "UPDATE", false),
            ("authority_directory_records", "DELETE", false),
        ] {
            let allowed: bool = sqlx::query_scalar("SELECT has_table_privilege('civiclens_runtime',format('%I.%I',current_schema(),$1::text),$2)")
                .bind(table).bind(privilege).fetch_one(pool).await.unwrap();
            assert_eq!(allowed, expected, "runtime {privilege} on {table}");
        }
        import_bundled(
            pool,
            std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/data")),
        )
        .await
        .unwrap();
        let report = status(pool).await.unwrap();
        assert_eq!(report["recordsByKind"]["statistical_area"], 567);
        assert!(report["recordsByKind"]["organisation"].as_i64().unwrap() >= 79);
        assert_eq!(report["recordsByKind"]["service_directory"], 16);
        assert_eq!(
            report["areaCoverage"]["AU-VIC"]["councilIdentityCandidates"],
            79
        );
        assert_eq!(report["areaCoverage"]["AU-VIC"]["nonSpecialAreas"], 79);
        assert_eq!(load_verified(pool).await.unwrap().len(), 1);
    }

    #[test]
    fn reference_imports_cannot_claim_routing_verification_or_hide_invalid_rows() {
        let good = reference();
        let parsed = parse_reference(&serde_json::to_vec(&good).unwrap()).unwrap();
        assert_eq!(parsed.records.len(), 1);
        assert_eq!(parsed.source_id, "au-test");
        for bad in [
            {
                let mut v = good.clone();
                v["sourceId"] = json!("civiclens-reviewed-authorities");
                v
            },
            {
                let mut v = good.clone();
                v["records"][0]["kind"] = json!("verified_authority");
                v
            },
            {
                let mut v = good.clone();
                v["records"][0]["verificationStatus"] = json!("verified");
                v
            },
            {
                let mut v = good.clone();
                v["sourceUrl"] = json!("http://official.gov.au/data");
                v
            },
            {
                let mut v = good.clone();
                v["upstreamSha256"] = json!("unhashed");
                v
            },
            {
                let mut v = good.clone();
                v["records"][0]["evidenceUrl"] = json!("https://user:password@official.gov.au/");
                v
            },
            {
                let mut v = good.clone();
                v["records"] = json!([v["records"][0].clone(), v["records"][0].clone()]);
                v
            },
        ] {
            assert!(
                parse_reference(&serde_json::to_vec(&bad).unwrap()).is_err(),
                "{bad}"
            );
        }
    }
}
