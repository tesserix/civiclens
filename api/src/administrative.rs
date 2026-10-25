use crate::{auth::Member, error::Error, AppState};
use axum::{
    extract::{Query, State},
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use ts_rs::TS;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DirectoryQuery {
    country_code: String,
    level: Option<String>,
    parent_id: Option<String>,
    q: Option<String>,
    before: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AdministrativeUnit {
    id: String,
    source_id: String,
    name: String,
    country_code: String,
    level: String,
    parent_id: Option<String>,
    region_code: Option<String>,
    official_code: Option<String>,
    official_url: Option<String>,
    contact_url: Option<String>,
    evidence_url: String,
    source_url: String,
    licence_url: String,
    attribution: String,
    retrieved_at: String,
    verification_status: String,
    complaint_api_status: String,
    district_ids: Vec<String>,
    district_coverage: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AdministrativePage {
    items: Vec<AdministrativeUnit>,
    next_cursor: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Cursor {
    name: String,
    source: String,
    id: String,
}

fn decode(value: &str) -> Result<Cursor, Error> {
    if value.len() > 4096 {
        return Err(Error::Invalid("Invalid directory cursor."));
    }
    let bytes = URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| Error::Invalid("Invalid directory cursor."))?;
    let cursor: Cursor =
        serde_json::from_slice(&bytes).map_err(|_| Error::Invalid("Invalid directory cursor."))?;
    if cursor.name.len() > 2000 || cursor.source.len() > 120 || cursor.id.len() > 120 {
        return Err(Error::Invalid("Invalid directory cursor."));
    }
    Ok(cursor)
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    _member: Member,
    Query(input): Query<DirectoryQuery>,
) -> Result<Json<AdministrativePage>, Error> {
    let limit = input.limit.unwrap_or(20);
    if !(1..=50).contains(&limit)
        || !matches!(input.country_code.as_str(), "AU" | "IN" | "NP" | "NZ")
        || input.level.as_ref().is_some_and(|v| {
            !matches!(
                v.as_str(),
                "country"
                    | "state"
                    | "province"
                    | "region"
                    | "district"
                    | "municipality"
                    | "council"
                    | "protected_area"
                    | "statistical_area"
            )
        })
        || input.parent_id.as_ref().is_some_and(|v| v.len() > 120)
        || input
            .q
            .as_ref()
            .is_some_and(|v| v.chars().count() > 80 || v.chars().any(char::is_control))
    {
        return Err(Error::Invalid(
            "Choose a supported country, reference level and page size up to 50.",
        ));
    }
    let cursor = input.before.as_deref().map(decode).transpose()?;
    let search = input.q.as_deref().unwrap_or("").trim().to_lowercase();
    let rows=sqlx::query("SELECT d.record_id,d.source_id,d.name,d.country_code,coalesce(d.administrative_level,'statistical_area') AS level,d.parent_record_id,d.region_code,d.payload,d.complaint_api_status,d.retrieved_at,i.source_url,i.licence_url,i.attribution FROM current_authority_directory d JOIN authority_directory_imports i ON i.id=d.import_id WHERE d.source_kind='reference' AND d.kind IN ('administrative_unit','statistical_area') AND d.country_code=$1 AND ($2::text IS NULL OR coalesce(d.administrative_level,'statistical_area')=$2) AND ($3::text IS NULL OR d.parent_record_id=$3 OR (d.country_code='AU' AND d.region_code=$3) OR (d.payload#>'{details,districtIds}') @> jsonb_build_array($3::text)) AND strpos(lower(d.name),$4)>0 AND ($5::text IS NULL OR (d.name,d.source_id,d.record_id)>($5,$6,$7)) ORDER BY d.name,d.source_id,d.record_id LIMIT $8")
        .bind(&input.country_code).bind(&input.level).bind(&input.parent_id).bind(search)
        .bind(cursor.as_ref().map(|c|c.name.as_str())).bind(cursor.as_ref().map(|c|c.source.as_str())).bind(cursor.as_ref().map(|c|c.id.as_str())).bind(limit+1)
        .fetch_all(&state.pool).await?;
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let payload: serde_json::Value = row.get("payload");
        let details = &payload["details"];
        items.push(AdministrativeUnit {
            id: row.get("record_id"),
            source_id: row.get("source_id"),
            name: row.get("name"),
            country_code: row.get("country_code"),
            level: row.get("level"),
            parent_id: row.get("parent_record_id"),
            region_code: row.get("region_code"),
            official_code: details["officialCode"].as_str().map(str::to_string),
            official_url: payload["officialUrl"].as_str().map(str::to_string),
            contact_url: details["contactUrl"].as_str().map(str::to_string),
            evidence_url: payload["evidenceUrl"]
                .as_str()
                .ok_or(Error::Internal)?
                .to_string(),
            source_url: row.get("source_url"),
            licence_url: row.get("licence_url"),
            attribution: row.get("attribution"),
            retrieved_at: row
                .get::<OffsetDateTime, _>("retrieved_at")
                .format(&Rfc3339)
                .map_err(|_| Error::Internal)?,
            verification_status: "reference".to_string(),
            complaint_api_status: row.get("complaint_api_status"),
            district_ids: details["districtIds"]
                .as_array()
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|v| v.as_str().map(str::to_string))
                        .collect()
                })
                .unwrap_or_default(),
            district_coverage: details["districtCoverage"].as_str().map(str::to_string),
        });
    }
    let next_cursor = if items.len() > limit as usize {
        items.truncate(limit as usize);
        items
            .last()
            .map(|last| {
                serde_json::to_vec(&Cursor {
                    name: last.name.clone(),
                    source: last.source_id.clone(),
                    id: last.id.clone(),
                })
                .map(|v| URL_SAFE_NO_PAD.encode(v))
                .map_err(|_| Error::Internal)
            })
            .transpose()?
    } else {
        None
    };
    Ok(Json(AdministrativePage { items, next_cursor }))
}
