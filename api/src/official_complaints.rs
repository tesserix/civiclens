use crate::{
    auth::Member,
    contracts::{Category, Report, COMMUNITY_RULES_VERSION},
    error::Error,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use std::{collections::HashSet, sync::OnceLock};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum OfficialIssue {
    Crime,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum OfficialBlocker {
    NoProviderRegistered,
    ProviderAccessPending,
    IncidentScopeUnverified,
    PoliceJurisdictionUnverified,
    EvidenceContractUnverified,
    ReceiptContractUnverified,
    SandboxUnavailable,
    AdapterNotImplemented,
    ComplaintCreateUndocumented,
    SourceReviewExpired,
    SourceReviewNotYetEffective,
    IndependentReviewUnverified,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialReferenceSource {
    source_id: String,
    country_code: String,
    source_url: String,
    licence_url: String,
    retrieved_at: String,
    source_sha256: String,
    reviewed_at: String,
    expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialJurisdiction {
    pub id: String,
    pub name: String,
    country_code: String,
    pub level: String,
    pub parent_id: Option<String>,
    official_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialPhotoContract {
    verified: bool,
    mime_types: Vec<String>,
    max_photos: Option<u8>,
    max_bytes_per_photo: Option<u32>,
    originals_required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialProvider {
    pub id: String,
    name: String,
    country_code: String,
    region_id: String,
    issue_types: Vec<OfficialIssue>,
    documentation_url: String,
    specification_url: String,
    specification_version: String,
    reviewed_at: String,
    expires_at: String,
    documented_operations: Vec<String>,
    pub photo_contract: OfficialPhotoContract,
    blockers: Vec<OfficialBlocker>,
    submission_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialRouteInput {
    pub country_code: String,
    pub region_id: String,
    pub district_id: String,
    pub issue_type: OfficialIssue,
    pub location_confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialResolution {
    pub country_code: String,
    pub issue_type: OfficialIssue,
    pub region: OfficialJurisdiction,
    pub district: OfficialJurisdiction,
    pub reference_source: OfficialReferenceSource,
    pub provider: Option<OfficialProvider>,
    pub provider_district_code: Option<String>,
    pub provider_station_code: Option<String>,
    pub can_submit: bool,
    pub application_max_photos: u8,
    pub blockers: Vec<OfficialBlocker>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Catalogue {
    #[serde(flatten)]
    source: OfficialReferenceSource,
    units: Vec<OfficialJurisdiction>,
}

fn catalogue() -> Result<&'static Vec<Catalogue>, Error> {
    static CATALOGUE: OnceLock<Result<Vec<Catalogue>, serde_json::Error>> = OnceLock::new();
    CATALOGUE
        .get_or_init(|| {
            serde_json::from_str(include_str!("../data/official-complaint-geography.json"))
        })
        .as_ref()
        .map_err(|_| Error::Internal)
}

fn reference(country: &str) -> Result<Option<&'static Catalogue>, Error> {
    Ok(catalogue()?
        .iter()
        .find(|c| c.source.country_code == country))
}

fn providers() -> Result<&'static Vec<OfficialProvider>, Error> {
    static PROVIDERS: OnceLock<Result<Vec<OfficialProvider>, serde_json::Error>> = OnceLock::new();
    PROVIDERS
        .get_or_init(|| {
            serde_json::from_str(include_str!("../data/official-complaint-providers.json"))
        })
        .as_ref()
        .map_err(|_| Error::Internal)
}

fn dates(
    reviewed: &str,
    expires: &str,
    now: OffsetDateTime,
) -> Result<Vec<OfficialBlocker>, Error> {
    let reviewed = OffsetDateTime::parse(reviewed, &Rfc3339).map_err(|_| Error::Internal)?;
    let expires = OffsetDateTime::parse(expires, &Rfc3339).map_err(|_| Error::Internal)?;
    if reviewed >= expires {
        return Err(Error::Internal);
    }
    Ok(if now < reviewed {
        vec![OfficialBlocker::SourceReviewNotYetEffective]
    } else if now >= expires {
        vec![OfficialBlocker::SourceReviewExpired]
    } else {
        vec![]
    })
}

pub fn validate_catalogue() -> Result<(), Error> {
    let mut countries = HashSet::new();
    for c in catalogue()? {
        if !valid_country(&c.source.country_code) || !countries.insert(&c.source.country_code) {
            return Err(Error::Internal);
        }
        let mut ids = HashSet::new();
        for unit in &c.units {
            if !ids.insert(&unit.id)
                || unit.country_code != c.source.country_code
                || unit.name.trim().is_empty()
            {
                return Err(Error::Internal);
            }
            match unit.level.as_str() {
                "region" if unit.parent_id.is_none() => {}
                "district"
                    if c.units
                        .iter()
                        .any(|p| Some(&p.id) == unit.parent_id.as_ref() && p.level == "region") => {
                }
                _ => return Err(Error::Internal),
            }
        }
        dates(
            &c.source.reviewed_at,
            &c.source.expires_at,
            OffsetDateTime::now_utc(),
        )?;
    }
    let mut ids = HashSet::new();
    for provider in providers()? {
        let c = reference(&provider.country_code)?.ok_or(Error::Internal)?;
        if !ids.insert(&provider.id)
            || provider.country_code != c.source.country_code
            || !c
                .units
                .iter()
                .any(|u| u.id == provider.region_id && u.level == "region")
            || provider.submission_supported
            || !provider
                .blockers
                .contains(&OfficialBlocker::AdapterNotImplemented)
            || provider.photo_contract.verified
            || provider.photo_contract.max_photos.is_some()
            || provider.photo_contract.max_bytes_per_photo.is_some()
            || provider.photo_contract.originals_required.is_some()
            || !provider.photo_contract.mime_types.is_empty()
            || providers()?.iter().any(|other| {
                other.id != provider.id
                    && other.country_code == provider.country_code
                    && other.region_id == provider.region_id
                    && other
                        .issue_types
                        .iter()
                        .any(|i| provider.issue_types.contains(i))
            })
        {
            return Err(Error::Internal);
        }
        dates(
            &provider.reviewed_at,
            &provider.expires_at,
            OffsetDateTime::now_utc(),
        )?;
    }
    Ok(())
}

fn valid_country(code: &str) -> bool {
    code.len() == 2 && code.bytes().all(|b| b.is_ascii_uppercase())
}

fn resolve_at(
    input: &OfficialRouteInput,
    now: OffsetDateTime,
) -> Result<OfficialResolution, Error> {
    if !input.location_confirmed
        || !valid_country(&input.country_code)
        || input.region_id.len() > 120
        || input.district_id.len() > 120
    {
        return Err(Error::Invalid(
            "Confirm a supported incident country, region and district.",
        ));
    }
    let c = reference(&input.country_code)?.ok_or(Error::Invalid(
        "No incident reference hierarchy is registered for this country.",
    ))?;
    let region = c
        .units
        .iter()
        .find(|u| u.level == "region" && u.id == input.region_id)
        .ok_or(Error::Invalid("Choose a known incident region."))?;
    let district = c
        .units
        .iter()
        .find(|u| {
            u.level == "district"
                && u.id == input.district_id
                && u.parent_id.as_deref() == Some(&region.id)
        })
        .ok_or(Error::Invalid(
            "The district must belong to the selected incident region.",
        ))?;
    let provider = providers()?
        .iter()
        .find(|p| {
            p.country_code == input.country_code
                && p.region_id == region.id
                && p.issue_types.contains(&input.issue_type)
        })
        .cloned();
    let mut blockers = dates(&c.source.reviewed_at, &c.source.expires_at, now)?;
    if let Some(p) = &provider {
        blockers.extend(p.blockers.clone());
        blockers.extend(dates(&p.reviewed_at, &p.expires_at, now)?);
    } else {
        blockers.push(OfficialBlocker::NoProviderRegistered);
    }
    for required in [
        OfficialBlocker::PoliceJurisdictionUnverified,
        OfficialBlocker::EvidenceContractUnverified,
        OfficialBlocker::IndependentReviewUnverified,
        OfficialBlocker::AdapterNotImplemented,
    ] {
        if !blockers.contains(&required) {
            blockers.push(required);
        }
    }
    let mut seen = Vec::new();
    blockers.retain(|b| {
        if seen.contains(b) {
            false
        } else {
            seen.push(b.clone());
            true
        }
    });
    Ok(OfficialResolution {
        country_code: input.country_code.clone(),
        issue_type: input.issue_type.clone(),
        region: region.clone(),
        district: district.clone(),
        reference_source: c.source.clone(),
        provider,
        provider_district_code: None,
        provider_station_code: None,
        can_submit: false,
        application_max_photos: 5,
        blockers,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialProviderQuery {
    country_code: String,
    region_id: Option<String>,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct OfficialProviderPage {
    items: Vec<OfficialProvider>,
    submission_available: bool,
}

pub async fn list_providers(
    _member: Member,
    Query(input): Query<OfficialProviderQuery>,
) -> Result<Json<OfficialProviderPage>, Error> {
    if !valid_country(&input.country_code)
        || input.region_id.as_ref().is_some_and(|s| s.len() > 120)
    {
        return Err(Error::Invalid(
            "Choose an ISO country code and valid region.",
        ));
    }
    if let Some(region) = &input.region_id {
        let c = reference(&input.country_code)?.ok_or(Error::Invalid(
            "No reference hierarchy is registered for this selection.",
        ))?;
        if !c
            .units
            .iter()
            .any(|u| u.id == *region && u.level == "region")
        {
            return Err(Error::Invalid("Choose a known incident region."));
        }
    }
    Ok(Json(OfficialProviderPage {
        items: providers()?
            .iter()
            .filter(|p| {
                p.country_code == input.country_code
                    && input.region_id.as_ref().is_none_or(|r| r == &p.region_id)
            })
            .cloned()
            .collect(),
        submission_available: false,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialJurisdictionQuery {
    country_code: String,
    region_id: Option<String>,
    cursor: Option<String>,
    limit: Option<usize>,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct OfficialJurisdictionPage {
    items: Vec<OfficialJurisdiction>,
    next_cursor: Option<String>,
    reference_source: Option<OfficialReferenceSource>,
    police_mapping_verified: bool,
}

pub async fn list_jurisdictions(
    _member: Member,
    Query(input): Query<OfficialJurisdictionQuery>,
) -> Result<Json<OfficialJurisdictionPage>, Error> {
    let limit = input.limit.unwrap_or(20);
    if !valid_country(&input.country_code)
        || !(1..=50).contains(&limit)
        || input.cursor.as_ref().is_some_and(|v| v.len() > 120)
    {
        return Err(Error::Invalid(
            "Choose a valid country, cursor and page size up to 50.",
        ));
    }
    let Some(c) = reference(&input.country_code)? else {
        if input.region_id.is_some() || input.cursor.is_some() {
            return Err(Error::Invalid(
                "No reference hierarchy is registered for this selection.",
            ));
        }
        return Ok(Json(OfficialJurisdictionPage {
            items: vec![],
            next_cursor: None,
            reference_source: None,
            police_mapping_verified: false,
        }));
    };
    if input
        .region_id
        .as_ref()
        .is_some_and(|r| !c.units.iter().any(|u| u.id == *r && u.level == "region"))
    {
        return Err(Error::Invalid("Choose a known incident region."));
    }
    let mut units: Vec<_> = c
        .units
        .iter()
        .filter(|u| {
            if let Some(r) = &input.region_id {
                u.level == "district" && u.parent_id.as_ref() == Some(r)
            } else {
                u.level == "region"
            }
        })
        .cloned()
        .collect();
    units.sort_by(|a, b| (&a.name, &a.id).cmp(&(&b.name, &b.id)));
    let start = match input.cursor {
        Some(cursor) => units
            .iter()
            .position(|u| u.id == cursor)
            .map(|i| i + 1)
            .ok_or(Error::Invalid(
                "The cursor does not belong to this selection.",
            ))?,
        None => 0,
    };
    let next_cursor = (units.len() > start + limit).then(|| units[start + limit - 1].id.clone());
    Ok(Json(OfficialJurisdictionPage {
        items: units.into_iter().skip(start).take(limit).collect(),
        next_cursor,
        reference_source: Some(c.source.clone()),
        police_mapping_verified: false,
    }))
}

pub async fn resolve(
    _member: Member,
    Json(input): Json<OfficialRouteInput>,
) -> Result<Json<OfficialResolution>, Error> {
    Ok(Json(resolve_at(&input, OffsetDateTime::now_utc())?))
}

#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialRequestInput {
    pub routing: OfficialRouteInput,
    pub consent: bool,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct OfficialRequest {
    id: String,
    report_id: String,
    status: String,
    dispatch_attempted: bool,
    official_reference: Option<String>,
    resolution: OfficialResolution,
    created_at: String,
}

fn request_row(row: &sqlx::postgres::PgRow) -> Result<OfficialRequest, Error> {
    let mut resolution: OfficialResolution =
        serde_json::from_value(row.get("resolution")).map_err(|_| Error::Internal)?;
    resolution.can_submit = false;
    Ok(OfficialRequest {
        id: row.get::<Uuid, _>("id").to_string(),
        report_id: row.get::<Uuid, _>("report_id").to_string(),
        status: "blocked".into(),
        dispatch_attempted: false,
        official_reference: None,
        resolution,
        created_at: row
            .get::<OffsetDateTime, _>("created_at")
            .format(&Rfc3339)
            .map_err(|_| Error::Internal)?,
    })
}

pub async fn create_request(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(report_id): Path<Uuid>,
    headers: HeaderMap,
    Json(input): Json<OfficialRequestInput>,
) -> Result<Json<OfficialRequest>, Error> {
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query("SELECT report FROM reports WHERE id=$1 AND owner_id=$2 FOR KEY SHARE")
        .bind(report_id)
        .bind(member.id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::NotFound)?;
    let report = row.get::<sqlx::types::Json<Report>, _>("report").0;
    if !input.consent
        || report.category != Category::PublicSafety
        || report.location.country_code != input.routing.country_code
    {
        return Err(Error::Invalid("Confirm an owned public-safety report and its actual incident country before creating an internal request."));
    }
    let key = headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or(Error::Invalid("A unique submission key is required."))?;
    let hash = crate::auth::hash(
        &serde_json::to_string(&(report_id, &input)).map_err(|_| Error::Internal)?,
    );
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,14))")
        .bind(member.id.to_string())
        .execute(&mut *tx)
        .await?;
    if let Some(existing)=sqlx::query("SELECT id,report_id,payload_hash,resolution,created_at FROM official_complaint_requests WHERE owner_id=$1 AND submission_key=$2")
        .bind(member.id).bind(key).fetch_optional(&mut *tx).await? {
        if existing.get::<String,_>("payload_hash") != hash { return Err(Error::Conflict("This submission key belongs to a different request.")); }
        let result=request_row(&existing)?;
        tx.commit().await?;
        return Ok(Json(result));
    }
    let resolution = resolve_at(&input.routing, OffsetDateTime::now_utc())?;
    let quota=sqlx::query("SELECT count(*) AS total,count(*) FILTER (WHERE created_at>=clock_timestamp()-interval '24 hours') AS daily FROM official_complaint_requests WHERE owner_id=$1")
        .bind(member.id).fetch_one(&mut *tx).await?;
    if quota.get::<i64, _>("total") >= 1000 || quota.get::<i64, _>("daily") >= 50 {
        return Err(Error::RateLimited("Your internal complaint request limit has been reached. Existing requests remain available."));
    }
    let id = Uuid::now_v7();
    let snapshot = serde_json::to_value(&resolution).map_err(|_| Error::Internal)?;
    let row=sqlx::query("INSERT INTO official_complaint_requests(id,owner_id,report_id,submission_key,payload_hash,resolution,rules_version) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,report_id,resolution,created_at")
        .bind(id).bind(member.id).bind(report_id).bind(key).bind(hash).bind(snapshot).bind(COMMUNITY_RULES_VERSION).fetch_one(&mut *tx).await?;
    sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'create_blocked_official_request',$2,jsonb_build_object('requestId',$3::text,'dispatchAttempted',false,'consent',true))")
        .bind(member.id).bind(report_id).bind(id.to_string()).execute(&mut *tx).await?;
    let result = request_row(&row)?;
    tx.commit().await?;
    Ok(Json(result))
}

pub async fn get_request(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
) -> Result<Json<OfficialRequest>, Error> {
    let row=sqlx::query("SELECT q.id,q.report_id,q.resolution,q.created_at FROM official_complaint_requests q JOIN reports r ON r.id=q.report_id AND r.owner_id=q.owner_id WHERE q.id=$1 AND q.owner_id=$2")
        .bind(id).bind(member.id).fetch_optional(&state.pool).await?.ok_or(Error::NotFound)?;
    Ok(Json(request_row(&row)?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OfficialHistoryQuery {
    cursor: Option<Uuid>,
    limit: Option<i64>,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct OfficialRequestPage {
    items: Vec<OfficialRequest>,
    next_cursor: Option<String>,
}

pub async fn request_history(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(report_id): Path<Uuid>,
    Query(input): Query<OfficialHistoryQuery>,
) -> Result<Json<OfficialRequestPage>, Error> {
    let owned: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM reports WHERE id=$1 AND owner_id=$2)")
            .bind(report_id)
            .bind(member.id)
            .fetch_one(&state.pool)
            .await?;
    if !owned {
        return Err(Error::NotFound);
    }
    let limit = input.limit.unwrap_or(20);
    if !(1..=50).contains(&limit) {
        return Err(Error::Invalid("Choose a page size up to 50."));
    }
    let rows=sqlx::query("SELECT id,report_id,resolution,created_at FROM official_complaint_requests WHERE owner_id=$1 AND report_id=$2 AND ($3::uuid IS NULL OR id<$3) ORDER BY id DESC LIMIT $4")
        .bind(member.id).bind(report_id).bind(input.cursor).bind(limit+1).fetch_all(&state.pool).await?;
    let mut items = rows
        .iter()
        .map(request_row)
        .collect::<Result<Vec<_>, _>>()?;
    let more = items.len() > limit as usize;
    items.truncate(limit as usize);
    let next_cursor = if more {
        items.last().map(|i| i.id.clone())
    } else {
        None
    };
    Ok(Json(OfficialRequestPage { items, next_cursor }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::{format_description::well_known::Rfc3339, OffsetDateTime};

    fn now() -> OffsetDateTime {
        OffsetDateTime::parse("2026-10-25T12:00:00Z", &Rfc3339).unwrap()
    }

    fn tamil_nadu() -> OfficialRouteInput {
        OfficialRouteInput {
            country_code: "IN".into(),
            region_id: "in-state-33".into(),
            district_id: "in-district-610".into(),
            issue_type: OfficialIssue::Crime,
            location_confirmed: true,
        }
    }

    #[test]
    fn generated_reference_preserves_the_pinned_source_without_inventing_jurisdictions() {
        let original = include_str!("../data/directory/in-lgd-administrative.json");
        let source: serde_json::Value = serde_json::from_str(original).unwrap();
        let c = reference("IN").unwrap().unwrap();
        assert_eq!(crate::auth::hash(original), c.source.source_sha256);
        let records = source["records"].as_array().unwrap();
        for unit in &c.units {
            let row = records.iter().find(|r| r["id"] == unit.id).unwrap();
            assert_eq!(row["name"], unit.name);
            assert_eq!(row["countryCode"], unit.country_code);
            assert_eq!(row["details"]["officialCode"], unit.official_code);
            if unit.level == "district" {
                assert_eq!(
                    row["details"]["parentId"],
                    unit.parent_id.as_deref().unwrap()
                );
            }
        }
        validate_catalogue().unwrap();
    }

    #[test]
    fn source_window_boundaries_and_blockers_are_explicit_and_unique() {
        let source = reference("IN").unwrap().unwrap();
        let expiry = OffsetDateTime::parse(&source.source.expires_at, &Rfc3339).unwrap();
        let expired = resolve_at(&tamil_nadu(), expiry).unwrap();
        assert!(expired
            .blockers
            .contains(&OfficialBlocker::SourceReviewExpired));
        assert_eq!(
            expired
                .blockers
                .iter()
                .filter(|b| **b == OfficialBlocker::SourceReviewExpired)
                .count(),
            1
        );
        let future = OffsetDateTime::parse("2026-10-24T00:00:00Z", &Rfc3339).unwrap();
        assert!(resolve_at(&tamil_nadu(), future)
            .unwrap()
            .blockers
            .contains(&OfficialBlocker::SourceReviewNotYetEffective));
    }

    #[test]
    fn reference_hierarchy_is_complete_but_police_codes_are_never_inferred() {
        let catalogue = reference("IN").unwrap().unwrap();
        assert_eq!(
            catalogue
                .units
                .iter()
                .filter(|u| u.level == "region")
                .count(),
            36
        );
        assert_eq!(
            catalogue
                .units
                .iter()
                .filter(|u| u.level == "district")
                .count(),
            784
        );
        let plan = resolve_at(&tamil_nadu(), now()).unwrap();
        assert_eq!(plan.region.id, "in-state-33");
        assert_eq!(plan.district.id, "in-district-610");
        assert_eq!(
            plan.provider.as_ref().unwrap().id,
            "in-tamil-nadu-police-umang"
        );
        assert!(plan.provider_district_code.is_none());
        assert!(!plan.can_submit);
        assert!(plan
            .blockers
            .contains(&OfficialBlocker::PoliceJurisdictionUnverified));
        assert!(plan
            .blockers
            .contains(&OfficialBlocker::EvidenceContractUnverified));
        assert!(plan
            .blockers
            .contains(&OfficialBlocker::AdapterNotImplemented));
        assert_eq!(plan.application_max_photos, 5);
        assert!(plan.provider.unwrap().photo_contract.max_photos.is_none());
    }

    #[test]
    fn cross_state_cross_country_and_unconfirmed_selections_are_rejected() {
        let mut input = tamil_nadu();
        input.region_id = "in-state-32".into();
        assert!(resolve_at(&input, now()).is_err());
        input = tamil_nadu();
        input.country_code = "NZ".into();
        assert!(resolve_at(&input, now()).is_err());
        input = tamil_nadu();
        input.location_confirmed = false;
        assert!(resolve_at(&input, now()).is_err());
        input = tamil_nadu();
        input.district_id = "in-district-unknown".into();
        assert!(resolve_at(&input, now()).is_err());
    }

    #[test]
    fn expired_sources_and_unregistered_providers_fail_closed() {
        let expired = OffsetDateTime::parse("2027-02-01T00:00:00Z", &Rfc3339).unwrap();
        let plan = resolve_at(&tamil_nadu(), expired).unwrap();
        assert!(plan
            .blockers
            .contains(&OfficialBlocker::SourceReviewExpired));
        let c = reference("IN").unwrap().unwrap();
        let district = c
            .units
            .iter()
            .find(|u| u.parent_id.as_deref() == Some("in-state-32"))
            .unwrap();
        let input = OfficialRouteInput {
            region_id: "in-state-32".into(),
            district_id: district.id.clone(),
            ..tamil_nadu()
        };
        let plan = resolve_at(&input, now()).unwrap();
        assert!(plan.provider.is_none());
        assert!(plan
            .blockers
            .contains(&OfficialBlocker::NoProviderRegistered));
        assert!(!plan.can_submit);
    }
}
