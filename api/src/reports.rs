use crate::{
    auth::{hash, Member, Moderator},
    authority,
    contracts::*,
    error::Error,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap},
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use sqlx::Row;
use std::{collections::HashSet, io::Cursor, sync::Arc};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

pub fn description_valid(text: &str) -> bool {
    (10..=1000).contains(&text.trim().chars().count())
}

fn validate(input: &ReportInput) -> Result<(), Error> {
    if input.community_rules_version.as_deref() != Some(COMMUNITY_RULES_VERSION) {
        return Err(Error::Invalid("Read and accept the current community rules. Update the app if this option is unavailable."));
    }
    if input
        .additional_photos_base64
        .as_ref()
        .is_some_and(|photos| photos.len() > 4)
    {
        return Err(Error::Invalid("Choose at most five photos."));
    }
    let l = &input.location;
    if !l.latitude.is_finite()
        || !l.longitude.is_finite()
        || !(-90.0..=90.0).contains(&l.latitude)
        || !(-180.0..=180.0).contains(&l.longitude)
        || l.country_code.len() != 2
        || !l.country_code.bytes().all(|b| b.is_ascii_uppercase())
        || !(2..=120).contains(&l.locality.trim().len())
        || !description_valid(&input.description)
        || input.hashtags.as_ref().is_some_and(|tags| {
            tags.len() > 64
                || tags.iter().any(|tag| {
                    !(2..=81).contains(&tag.len())
                        || !tag.starts_with('#')
                        || !tag[1..].bytes().all(|byte| byte.is_ascii_alphanumeric())
                })
                || tags.iter().collect::<HashSet<_>>().len() != tags.len()
        })
        || (input.reporter_confirmed == Some(true)
            && (input.sharing_mode != Some(SharingMode::Manual) || input.channels.is_empty()))
        || !input.consent
        || (input.channels.is_empty() && input.complaint_requested != Some(true))
        || (input.complaint_requested == Some(true)
            && input.sharing_mode != Some(SharingMode::Manual))
        || input.channels.len() > crate::contracts::Channel::ALL.len()
        || (input.channels.contains(&crate::contracts::Channel::Tiktok)
            && input.sharing_mode != Some(SharingMode::Manual))
        || input
            .channels
            .iter()
            .map(|c| c.as_str())
            .collect::<HashSet<_>>()
            .len()
            != input.channels.len()
    {
        return Err(Error::Invalid("Add a photo, a 10–1000 character description, valid location, channels, and publishing consent."));
    }
    Ok(())
}

pub fn sanitize_photo(encoded: &str, edge: u32) -> Result<Vec<u8>, Error> {
    if encoded.len() > 8_000_000 {
        return Err(Error::Invalid("Photo is too large."));
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| Error::Invalid("Invalid photo encoding."))?;
    if bytes.is_empty() || bytes.len() > 6_000_000 {
        return Err(Error::Invalid("Photo must be at most 6 MB."));
    }
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| Error::Invalid("Invalid photo."))?;
    if !matches!(
        reader.format(),
        Some(image::ImageFormat::Jpeg | image::ImageFormat::Png | image::ImageFormat::WebP)
    ) {
        return Err(Error::Invalid("Use a JPEG, PNG or WebP photo."));
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(6000);
    limits.max_image_height = Some(6000);
    limits.max_alloc = Some(96_000_000);
    reader.limits(limits);
    let decoded = reader
        .decode()
        .map_err(|_| Error::Invalid("Photo could not be decoded or exceeds image limits."))?;
    let rgb = decoded.thumbnail(edge, edge).to_rgb8();
    let mut output = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, 85)
        .encode_image(&rgb)
        .map_err(|_| Error::Invalid("Photo could not be processed."))?;
    Ok(output)
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    member: Member,
    headers: HeaderMap,
    Json(mut input): Json<ReportInput>,
) -> Result<Json<Report>, Error> {
    validate(&input)?;
    let key = headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or(Error::Invalid("A UUID Idempotency-Key header is required."))?;
    let payload_hash = hash(&serde_json::to_string(&input).map_err(|_| Error::Internal)?);
    if let Some(existing) =
        sqlx::query("SELECT id,payload_hash FROM reports WHERE owner_id=$1 AND idempotency_key=$2")
            .bind(member.id)
            .bind(key)
            .fetch_optional(&state.pool)
            .await?
    {
        if existing.get::<String, _>("payload_hash") != payload_hash {
            return Err(Error::Conflict(
                "Submission key was already used with a different report.",
            ));
        }
        return Ok(Json(
            read(&state, existing.get("id"), Some(member.id)).await?,
        ));
    }
    let count = 1 + input.additional_photos_base64.as_ref().map_or(0, Vec::len);
    if count > 1 && state.media.is_none() {
        return Err(Error::Unavailable);
    }
    let permit = state
        .photo_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| Error::Unavailable)?;
    let mut encoded = vec![std::mem::take(&mut input.photo_base64)];
    encoded.extend(input.additional_photos_base64.take().unwrap_or_default());
    let photos = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        encoded
            .iter()
            .map(|photo| sanitize_photo(photo, 1600))
            .collect::<Result<Vec<_>, _>>()
    })
    .await
    .map_err(|_| Error::Internal)??;
    let now = OffsetDateTime::now_utc();
    let id = Uuid::now_v7();
    let matches = authority::route(&state.authorities, &input.location, input.category, now);
    if let Some(selected) = &input.hashtags {
        let allowed = if matches.is_empty() {
            vec![]
        } else {
            authority::hashtags(&matches, input.category)
        };
        if selected.iter().any(|tag| !allowed.contains(tag)) {
            return Err(Error::Invalid(
                "Choose hashtags from the current location suggestions, then retry.",
            ));
        }
    }
    let mut references = Vec::new();
    if let Some(store) = &state.media {
        for (index, photo) in photos.iter().enumerate() {
            references.push(
                store
                    .put(
                        &format!("reports/{}/{}/{}/{index}.jpg", member.id, key, payload_hash),
                        photo,
                    )
                    .await?,
            );
        }
    }
    let report = Report {
        complaint_requested: input.complaint_requested,
        sharing_mode: input.sharing_mode,
        id: id.to_string(),
        nickname: member.nickname,
        photo_count: Some(count as u8),
        location_source: input.location_source,
        community_rules_version: input.community_rules_version,
        category: input.category,
        description: input.description.trim().to_string(),
        hashtags: input.hashtags,
        location: input.location,
        created_at: now.format(&Rfc3339).map_err(|_| Error::Internal)?,
        status: if input.reporter_confirmed == Some(true) {
            "ready_to_share"
        } else {
            "pending_review"
        }
        .into(),
        routing: Routing {
            status: if matches.is_empty() {
                "needs_verification"
            } else {
                "matched"
            }
            .into(),
            authority_names: matches.iter().map(|a| a.name.clone()).collect(),
        },
        publications: input
            .channels
            .iter()
            .map(|c| Publication {
                channel: *c,
                status: PublicationStatus::Blocked,
                provider_id: None,
                reason: Some(
                    if input.reporter_confirmed == Some(true) {
                        "Not posted. Share and confirm in your chosen app."
                    } else {
                        "Awaiting privacy and authority review"
                    }
                    .into(),
                ),
            })
            .collect(),
    };
    let mut tx = state.pool.begin().await?;
    let inserted = sqlx::query("INSERT INTO reports(id,owner_id,idempotency_key,payload_hash,report,photo) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(owner_id,idempotency_key) DO NOTHING")
        .bind(id).bind(member.id).bind(key).bind(&payload_hash).bind(sqlx::types::Json(&report)).bind(&photos[0]).execute(&mut *tx).await?;
    if inserted.rows_affected() == 0 {
        tx.rollback().await?;
        let existing = sqlx::query(
            "SELECT id,payload_hash FROM reports WHERE owner_id=$1 AND idempotency_key=$2",
        )
        .bind(member.id)
        .bind(key)
        .fetch_one(&state.pool)
        .await?;
        if existing.get::<String, _>("payload_hash") != payload_hash {
            return Err(Error::Conflict(
                "Submission key was already used with a different report.",
            ));
        }
        return Ok(Json(
            read(&state, existing.get("id"), Some(member.id)).await?,
        ));
    }
    for (index, reference) in references.iter().enumerate() {
        sqlx::query("INSERT INTO report_photos(report_id,position,bucket,object_name,object_generation) VALUES($1,$2,$3,$4,$5)")
            .bind(id).bind(index as i16).bind(&reference.bucket).bind(&reference.object).bind(&reference.generation).execute(&mut *tx).await?;
    }
    sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'accept_community_rules',$2,$3)")
        .bind(member.id).bind(id).bind(serde_json::json!({"version":COMMUNITY_RULES_VERSION})).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(report))
}

async fn read(state: &AppState, id: Uuid, owner: Option<Uuid>) -> Result<Report, Error> {
    let row =
        sqlx::query("SELECT report FROM reports WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2)")
            .bind(id)
            .bind(owner)
            .fetch_optional(&state.pool)
            .await?
            .ok_or(Error::NotFound)?;
    let mut report: Report = row.get::<sqlx::types::Json<Report>, _>("report").0;
    let publications = sqlx::query("SELECT channel,status,provider_id,reason FROM publications WHERE report_id=$1 ORDER BY channel")
        .bind(id).fetch_all(&state.pool).await?;
    if !publications.is_empty() {
        report.publications = publications.into_iter().map(|r| serde_json::from_value(serde_json::json!({
            "channel":r.get::<String,_>("channel"), "status":r.get::<String,_>("status"),
            "providerId":r.get::<Option<String>,_>("provider_id"), "reason":r.get::<Option<String>,_>("reason")
        })).map_err(|_| Error::Internal)).collect::<Result<_,_>>()?;
    }
    Ok(report)
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
) -> Result<Json<Report>, Error> {
    Ok(Json(read(&state, id, Some(member.id)).await?))
}

#[derive(Debug, Deserialize, Default)]
pub struct Page {
    before: Option<Uuid>,
    limit: Option<i64>,
}

async fn page(
    state: &AppState,
    owner: Option<Uuid>,
    page: Page,
) -> Result<serde_json::Value, Error> {
    let limit = page.limit.unwrap_or(20).clamp(1, 50);
    let rows = sqlx::query("SELECT r.report, COALESCE((SELECT jsonb_agg(jsonb_build_object('channel',p.channel,'status',p.status,'providerId',p.provider_id,'reason',p.reason) ORDER BY p.channel) FROM publications p WHERE p.report_id=r.id), r.report->'publications') AS publications FROM reports r WHERE ($1::uuid IS NULL OR r.owner_id=$1) AND ($2::uuid IS NULL OR r.id < $2) ORDER BY r.id DESC LIMIT $3")
        .bind(owner).bind(page.before).bind(limit+1).fetch_all(&state.pool).await?;
    let has_more = rows.len() > limit as usize;
    let mut items = Vec::new();
    for row in rows.into_iter().take(limit as usize) {
        let mut report = row.get::<sqlx::types::Json<Report>, _>("report").0;
        report.publications =
            serde_json::from_value(row.get("publications")).map_err(|_| Error::Internal)?;
        items.push(report);
    }
    let cursor = if has_more {
        items.last().map(|r| r.id.clone())
    } else {
        None
    };
    Ok(serde_json::json!({"items":items,"nextCursor":cursor}))
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    member: Member,
    Query(query): Query<Page>,
) -> Result<Json<serde_json::Value>, Error> {
    Ok(Json(page(&state, Some(member.id), query).await?))
}
pub async fn moderation_list(
    State(state): State<Arc<AppState>>,
    _moderator: Moderator,
    Query(query): Query<Page>,
) -> Result<Json<serde_json::Value>, Error> {
    Ok(Json(page(&state, None, query).await?))
}

pub async fn photo(
    State(state): State<Arc<AppState>>,
    _moderator: Moderator,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, Error> {
    let photo = load_photo(&state, id, 0).await?;
    Ok((
        [
            (header::CONTENT_TYPE, "image/jpeg"),
            (header::CACHE_CONTROL, "no-store"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        photo,
    ))
}

pub async fn load_photo(state: &AppState, id: Uuid, index: u8) -> Result<Vec<u8>, Error> {
    if index > 4 {
        return Err(Error::NotFound);
    }
    if let Some(row)=sqlx::query("SELECT bucket,object_name,object_generation FROM report_photos WHERE report_id=$1 AND position=$2")
        .bind(id).bind(i16::from(index)).fetch_optional(&state.pool).await? {
        let reference=crate::media::Reference {bucket:row.get("bucket"),object:row.get("object_name"),generation:row.get("object_generation")};
        return state.media.as_ref().ok_or(Error::Unavailable)?.get(&reference).await;
    }
    if index != 0 {
        return Err(Error::NotFound);
    }
    sqlx::query_scalar("SELECT photo FROM reports WHERE id=$1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error::NotFound)
}

pub async fn indexed_photo(
    State(state): State<Arc<AppState>>,
    _moderator: Moderator,
    Path((id, index)): Path<(Uuid, u8)>,
) -> Result<impl IntoResponse, Error> {
    Ok((
        [
            (header::CONTENT_TYPE, "image/jpeg"),
            (header::CACHE_CONTROL, "no-store"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        load_photo(&state, id, index).await?,
    ))
}

fn reviewed_offices<'a>(
    state: &'a AppState,
    report: &Report,
    include_parents: bool,
) -> Result<Vec<&'a authority::Authority>, Error> {
    let now = OffsetDateTime::now_utc();
    let mut offices = authority::route(&state.authorities, &report.location, report.category, now);
    if offices.is_empty() {
        return Err(Error::Conflict(
            "Verify one responsible authority and its boundary before publishing.",
        ));
    }
    if include_parents {
        let parents = offices[0].parents.clone();
        for parent in parents {
            let a = state
                .authorities
                .iter()
                .find(|a| {
                    a.id == parent && authority::matches(a, &report.location, report.category, now)
                })
                .ok_or(Error::Conflict(
                    "An escalation office is missing or expired.",
                ))?;
            if !offices.iter().any(|office| office.id == a.id) {
                offices.push(a);
            }
        }
    }
    Ok(offices)
}

pub async fn approve(
    State(state): State<Arc<AppState>>,
    moderator: Moderator,
    Path(id): Path<Uuid>,
    Json(input): Json<Approval>,
) -> Result<Json<Report>, Error> {
    if !input.photo_privacy_reviewed
        || !description_valid(&input.public_description)
        || !(2..=120).contains(&input.public_locality.trim().len())
    {
        return Err(Error::Invalid(
            "Review the photo, public description and locality before approval.",
        ));
    }
    if input
        .complaint_description
        .as_ref()
        .is_some_and(|text| !description_valid(text))
        || (input.complaint_description.is_some()
            != (input.complaint_factual_reviewed == Some(true)))
    {
        return Err(Error::Invalid(
            "Provide factual complaint text and confirm its separate review.",
        ));
    }
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query("SELECT report,owner_id,approval FROM reports WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::NotFound)?;
    if row.get::<Uuid, _>("owner_id") == moderator.0.id {
        return Err(Error::Forbidden);
    }
    let mut report = row.get::<sqlx::types::Json<Report>, _>("report").0;
    if report.complaint_requested == Some(true)
        && (input.complaint_description.is_none() || input.complaint_factual_reviewed != Some(true))
    {
        return Err(Error::Invalid("This report requests a government complaint. Separately review factual complaint text before approval."));
    }
    let count = report.photo_count.unwrap_or(1);
    if (count > 1 && input.reviewed_photo_count != Some(count))
        || input.reviewed_photo_count.is_some_and(|n| n != count)
    {
        return Err(Error::Invalid(
            "Review every photo and confirm the exact photo count before approval.",
        ));
    }
    if let Some(approval) = row.get::<Option<serde_json::Value>, _>("approval") {
        if approval != serde_json::to_value(&input).map_err(|_| Error::Internal)? {
            return Err(Error::Conflict(
                "Report was already approved with different public details.",
            ));
        }
        tx.commit().await?;
        return Ok(Json(read(&state, id, None).await?));
    }
    if report.community_rules_version.as_deref() != Some(COMMUNITY_RULES_VERSION) {
        return Err(Error::Conflict(
            "The reporter must submit with the current community rules before publication.",
        ));
    }
    if count > 1 && report.sharing_mode != Some(SharingMode::Manual) {
        return Err(Error::Conflict(
            "Use user-owned sharing for reports with multiple photos.",
        ));
    }
    let offices = reviewed_offices(&state, &report, input.include_parents)?;
    report.status = "approved".into();
    report.routing = Routing {
        status: "matched".into(),
        authority_names: offices.iter().map(|a| a.name.clone()).collect(),
    };
    for publication in report
        .publications
        .iter()
        .filter(|_| report.sharing_mode != Some(SharingMode::Manual))
    {
        let caption = authority::caption(
            &report,
            &input.public_description,
            &input.public_locality,
            &offices,
            publication.channel,
        );
        sqlx::query("INSERT INTO publications(id,report_id,channel,status,caption) VALUES($1,$2,$3,'queued',$4) ON CONFLICT(report_id,channel) DO NOTHING")
            .bind(Uuid::now_v7()).bind(id).bind(publication.channel.as_str()).bind(caption).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE reports SET report=$2,approval=$3,updated_at=now() WHERE id=$1")
        .bind(id)
        .bind(sqlx::types::Json(&report))
        .bind(sqlx::types::Json(&input))
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'approve_report',$2,$3)")
        .bind(moderator.0.id).bind(id).bind(serde_json::json!({"includeParents":input.include_parents,"photoPrivacyReviewed":true})).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(read(&state, id, None).await?))
}

pub async fn reviewed_export(
    state: &AppState,
    owner: Uuid,
    id: Uuid,
) -> Result<(Report, Approval), Error> {
    let row = sqlx::query("SELECT report,approval FROM reports WHERE id=$1 AND owner_id=$2")
        .bind(id)
        .bind(owner)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error::NotFound)?;
    let report = row.get::<sqlx::types::Json<Report>, _>("report").0;
    let approval: Approval = row
        .get::<Option<serde_json::Value>, _>("approval")
        .ok_or(Error::Conflict(
            "Every photo, text and responsible authority need independent review first.",
        ))
        .and_then(|value| serde_json::from_value(value).map_err(|_| Error::Internal))?;
    let count = report.photo_count.unwrap_or(1);
    if report.status != "approved"
        || report.sharing_mode != Some(SharingMode::Manual)
        || report.community_rules_version.as_deref() != Some(COMMUNITY_RULES_VERSION)
        || !(1..=5).contains(&count)
        || !approval.photo_privacy_reviewed
        || (count > 1 && approval.reviewed_photo_count != Some(count))
    {
        return Err(Error::Conflict(
            "This report needs fresh review before preparing an export.",
        ));
    }
    let offices = reviewed_offices(state, &report, approval.include_parents)?;
    if offices.iter().map(|a| &a.name).collect::<Vec<_>>()
        != report.routing.authority_names.iter().collect::<Vec<_>>()
    {
        return Err(Error::Conflict(
            "Responsible authorities changed; a fresh review is required.",
        ));
    }
    Ok((report, approval))
}

pub async fn share_package(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Json(input): Json<ShareRequest>,
) -> Result<Json<SharePackage>, Error> {
    if !input.identity_acknowledged {
        return Err(Error::Invalid(
            "Confirm that your social account identity may be visible before sharing.",
        ));
    }
    let (report, description, locality, offices) = if input.reporter_confirmed == Some(true) {
        let report = read(&state, id, Some(member.id)).await?;
        let count = report.photo_count.unwrap_or(1);
        if report.sharing_mode != Some(SharingMode::Manual)
            || !matches!(
                report.status.as_str(),
                "pending_review" | "ready_to_share" | "approved"
            )
            || input.community_rules_version.as_deref() != Some(COMMUNITY_RULES_VERSION)
            || !(1..=5).contains(&count)
            || input.confirmed_photo_count != Some(count)
        {
            return Err(Error::Conflict(
                "Confirm every photo and the current rules before sharing your own report.",
            ));
        }
        let offices = authority::route(
            &state.authorities,
            &report.location,
            report.category,
            OffsetDateTime::now_utc(),
        );
        let description = report.description.clone();
        // An editable locality is not evidence for authority mentions or place hashtags.
        let locality = if offices.is_empty() {
            "User-selected location".into()
        } else {
            report.location.locality.clone()
        };
        (report, description, locality, offices)
    } else {
        let (report, approval) = reviewed_export(&state, member.id, id).await?;
        let offices = reviewed_offices(&state, &report, approval.include_parents)?;
        (
            report,
            approval.public_description,
            approval.public_locality,
            offices,
        )
    };
    if !report
        .publications
        .iter()
        .any(|p| p.channel == input.channel)
    {
        return Err(Error::Conflict(
            "This destination was not selected for this report.",
        ));
    }
    let count = report.photo_count.unwrap_or(1);
    let caption = authority::caption(&report, &description, &locality, &offices, input.channel);
    crate::content_safety::check_publication(&state, &caption).await?;
    let mut photos_base64 = Vec::with_capacity(usize::from(count));
    for index in 0..count {
        photos_base64.push(STANDARD.encode(load_photo(&state, id, index).await?));
    }
    sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'prepare_user_share',$2,$3)")
        .bind(member.id).bind(id).bind(serde_json::json!({"channel":input.channel,"photoCount":count,"identityAcknowledged":true,"reporterConfirmed":input.reporter_confirmed == Some(true),"rulesVersion":input.community_rules_version})).execute(&state.pool).await?;
    Ok(Json(SharePackage {
        report_id: report.id,
        channel: input.channel,
        caption,
        photos_base64,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn submissions_require_current_rules_and_allow_at_most_five_photos() {
        let mut body = serde_json::json!({
            "category":"waste","description":"Litter beside the public path.",
            "location":{"latitude":-37.81,"longitude":144.96,"countryCode":"AU","locality":"Melbourne"},
            "photoBase64":"first", "additionalPhotosBase64":["two","three","four","five"],
            "channels":["facebook"],"consent":true,"communityRulesVersion":COMMUNITY_RULES_VERSION
        });
        let input: ReportInput = serde_json::from_value(body.clone()).unwrap();
        assert!(validate(&input).is_ok());
        let serialized = serde_json::to_value(&input).unwrap();
        assert!(
            !serialized
                .as_object()
                .unwrap()
                .contains_key("reporterConfirmed"),
            "legacy idempotency payload changed"
        );
        body["additionalPhotosBase64"] = serde_json::json!(["2", "3", "4", "5", "6"]);
        assert!(validate(&serde_json::from_value(body.clone()).unwrap()).is_err());
        body["additionalPhotosBase64"] = serde_json::json!([]);
        body["communityRulesVersion"] = serde_json::Value::Null;
        assert!(validate(&serde_json::from_value(body.clone()).unwrap()).is_err());
        body["communityRulesVersion"] = serde_json::json!("outdated");
        assert!(validate(&serde_json::from_value(body).unwrap()).is_err());
    }
}
