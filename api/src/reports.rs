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
    let l = &input.location;
    if !l.latitude.is_finite()
        || !l.longitude.is_finite()
        || !(-90.0..=90.0).contains(&l.latitude)
        || !(-180.0..=180.0).contains(&l.longitude)
        || l.country_code.len() != 2
        || !l.country_code.bytes().all(|b| b.is_ascii_uppercase())
        || !(2..=120).contains(&l.locality.trim().len())
        || !description_valid(&input.description)
        || !input.consent
        || input.channels.is_empty()
        || input.channels.len() > 3
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
    Json(input): Json<ReportInput>,
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
    let permit = state
        .photo_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| Error::Unavailable)?;
    let photo = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        sanitize_photo(&input.photo_base64, 1600)
    })
    .await
    .map_err(|_| Error::Internal)??;
    let now = OffsetDateTime::now_utc();
    let id = Uuid::now_v7();
    let matches = authority::route(&state.authorities, &input.location, input.category, now);
    let report = Report {
        id: id.to_string(),
        nickname: member.nickname,
        category: input.category,
        description: input.description.trim().to_string(),
        location: input.location,
        created_at: now.format(&Rfc3339).map_err(|_| Error::Internal)?,
        status: "pending_review".into(),
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
                reason: Some("Awaiting privacy and authority review".into()),
            })
            .collect(),
    };
    let inserted = sqlx::query("INSERT INTO reports(id,owner_id,idempotency_key,payload_hash,report,photo) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(owner_id,idempotency_key) DO NOTHING")
        .bind(id).bind(member.id).bind(key).bind(&payload_hash).bind(sqlx::types::Json(&report)).bind(photo).execute(&state.pool).await?;
    if inserted.rows_affected() == 0 {
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
    let photo: Vec<u8> = sqlx::query_scalar("SELECT photo FROM reports WHERE id=$1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error::NotFound)?;
    Ok((
        [
            (header::CONTENT_TYPE, "image/jpeg"),
            (header::CACHE_CONTROL, "no-store"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        photo,
    ))
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
    if let Some(approval) = row.get::<Option<serde_json::Value>, _>("approval") {
        if approval != serde_json::to_value(&input).map_err(|_| Error::Internal)? {
            return Err(Error::Conflict(
                "Report was already approved with different public details.",
            ));
        }
        tx.commit().await?;
        return Ok(Json(read(&state, id, None).await?));
    }
    let now = OffsetDateTime::now_utc();
    let mut offices = authority::route(&state.authorities, &report.location, report.category, now);
    if offices.is_empty() {
        return Err(Error::Conflict(
            "Verify one responsible authority and its boundary before publishing.",
        ));
    }
    if input.include_parents {
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
    report.status = "approved".into();
    report.routing = Routing {
        status: "matched".into(),
        authority_names: offices.iter().map(|a| a.name.clone()).collect(),
    };
    for publication in &report.publications {
        let caption = authority::caption(
            &report.nickname,
            &input.public_description,
            &input.public_locality,
            &report.location,
            &offices,
            publication.channel,
            report.category,
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
