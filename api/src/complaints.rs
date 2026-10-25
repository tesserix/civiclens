use crate::{
    auth::Member,
    authority,
    contracts::{Approval, Report, COMMUNITY_RULES_VERSION},
    error::Error,
    reports, AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ComplaintChannel {
    pub id: String,
    pub name: String,
    pub url: String,
    pub evidence_url: String,
    pub channel_type: String,
    pub api_status: String,
    pub authentication: String,
    pub verified_at: String,
    pub expires_at: String,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ComplaintOptions {
    pub channels: Vec<ComplaintChannel>,
    pub factual_text_reviewed: bool,
    pub history: Vec<ComplaintRecord>,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ComplaintRecord {
    pub id: String,
    pub channel_id: String,
    pub status: String,
}
#[derive(Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComplaintInput {
    pub channel_id: String,
    pub consent: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HandoffInput {
    pub consent: bool,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ComplaintPackage {
    pub id: String,
    pub report_id: String,
    pub status: String,
    pub channel: ComplaintChannel,
    pub text: String,
    pub photos_base64: Vec<String>,
}
#[derive(Serialize, Deserialize, PartialEq)]
struct Snapshot {
    channel: ComplaintChannel,
    text: String,
}

fn safe_official_url(value: &str) -> bool {
    reqwest::Url::parse(value).is_ok_and(|u| {
        let host = u.host_str().unwrap_or_default();
        u.scheme() == "https"
            && u.username().is_empty()
            && u.password().is_none()
            && u.port().is_none()
            && u.query().is_none()
            && u.fragment().is_none()
            && ["gov.au", "gov.in", "nic.in", "govt.nz", "gov.np"]
                .iter()
                .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
    })
}
async fn channels(state: &AppState, report: &Report) -> Result<Vec<ComplaintChannel>, Error> {
    let now = OffsetDateTime::now_utc();
    let matched = authority::route(&state.authorities, &report.location, report.category, now);
    if matched.len() != 1 {
        return Ok(vec![]);
    }
    let category = serde_json::to_value(report.category).map_err(|_| Error::Internal)?;
    let rows=sqlx::query("SELECT id,name,official_url,evidence_url,channel_type,api_status,authentication,verified_at,expires_at FROM complaint_channels WHERE authority_id=$1 AND country_code=$2 AND category=$3 AND verified_at<=clock_timestamp() AND expires_at>clock_timestamp() ORDER BY id LIMIT 20")
        .bind(&matched[0].id).bind(&report.location.country_code).bind(category.as_str().ok_or(Error::Internal)?).fetch_all(&state.pool).await?;
    rows.into_iter()
        .map(|r| {
            let url: String = r.get("official_url");
            let evidence_url: String = r.get("evidence_url");
            if !safe_official_url(&url) || !safe_official_url(&evidence_url) {
                return Err(Error::Unavailable);
            }
            Ok(ComplaintChannel {
                id: r.get("id"),
                name: r.get("name"),
                url,
                evidence_url,
                channel_type: r.get("channel_type"),
                api_status: r.get("api_status"),
                authentication: r.get("authentication"),
                verified_at: r
                    .get::<OffsetDateTime, _>("verified_at")
                    .format(&Rfc3339)
                    .map_err(|_| Error::Internal)?,
                expires_at: r
                    .get::<OffsetDateTime, _>("expires_at")
                    .format(&Rfc3339)
                    .map_err(|_| Error::Internal)?,
            })
        })
        .collect()
}
fn factual_text(report: &Report, approval: &Approval) -> Result<String, Error> {
    let text = approval
        .complaint_description
        .as_deref()
        .filter(|t| reports::description_valid(t))
        .filter(|_| approval.complaint_factual_reviewed == Some(true))
        .ok_or(Error::Conflict(
            "A moderator must separately review factual complaint text before preparation.",
        ))?;
    Ok(format!("{}\n\nLocation: {}, {}\nIssue: {}\nCivicLens report: {}\n\nPlease review this reported issue and advise on the appropriate action. This is a citizen report, not a finding of fault.",text.trim(),approval.public_locality,report.location.country_code,serde_json::to_value(report.category).map_err(|_|Error::Internal)?.as_str().ok_or(Error::Internal)?,report.id))
}
async fn snapshot(
    state: &AppState,
    owner: Uuid,
    id: Uuid,
    channel_id: &str,
) -> Result<(Snapshot, u8), Error> {
    let (report, approval) = reports::reviewed_export(state, owner, id).await?;
    if report.complaint_requested != Some(true) {
        return Err(Error::Conflict(
            "This report did not request complaint preparation.",
        ));
    }
    let channel = channels(state, &report)
        .await?
        .into_iter()
        .find(|c| c.id == channel_id)
        .ok_or(Error::Conflict(
            "No current verified complaint channel matches this report.",
        ))?;
    Ok((
        Snapshot {
            channel,
            text: factual_text(&report, &approval)?,
        },
        report.photo_count.unwrap_or(1),
    ))
}
pub async fn options(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
) -> Result<Json<ComplaintOptions>, Error> {
    let row = sqlx::query("SELECT report,approval FROM reports WHERE id=$1 AND owner_id=$2")
        .bind(id)
        .bind(member.id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error::NotFound)?;
    let report = row.get::<sqlx::types::Json<Report>, _>("report").0;
    let approval = row
        .get::<Option<serde_json::Value>, _>("approval")
        .and_then(|a| serde_json::from_value::<Approval>(a).ok());
    let history=sqlx::query("SELECT id,channel_id,status FROM complaint_intents WHERE report_id=$1 AND owner_id=$2 ORDER BY id DESC LIMIT 20").bind(id).bind(member.id).fetch_all(&state.pool).await?.into_iter().map(|r|ComplaintRecord{id:r.get::<Uuid,_>("id").to_string(),channel_id:r.get("channel_id"),status:r.get("status")}).collect();
    Ok(Json(ComplaintOptions {
        channels: channels(&state, &report).await?,
        factual_text_reviewed: report.status == "approved"
            && approval.is_some_and(|a| factual_text(&report, &a).is_ok()),
        history,
    }))
}
pub async fn prepare(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(input): Json<ComplaintInput>,
) -> Result<Json<ComplaintPackage>, Error> {
    // Ownership is checked before validating destination details.
    let (review, count) = snapshot(&state, member.id, id, &input.channel_id).await?;
    if !input.consent {
        return Err(Error::Invalid(
            "Confirm the destination and reviewed data before preparation.",
        ));
    }
    let key = headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or(Error::Invalid("A unique submission key is required."))?;
    let hash =
        crate::auth::hash(&serde_json::to_string(&(id, &input)).map_err(|_| Error::Internal)?);
    crate::content_safety::check_publication(&state, &review.text).await?;
    let mut photos = Vec::with_capacity(count as usize);
    for index in 0..count {
        photos.push(STANDARD.encode(reports::load_photo(&state, id, index).await?));
    }
    let package = serde_json::to_value(&review).map_err(|_| Error::Internal)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,13))")
        .bind(member.id.to_string())
        .execute(&mut *tx)
        .await?;
    let existing=sqlx::query("SELECT id,report_id,channel_id,payload_hash,status,package FROM complaint_intents WHERE owner_id=$1 AND (submission_key=$2 OR (report_id=$3 AND channel_id=$4)) ORDER BY (submission_key=$2) DESC,id LIMIT 1")
        .bind(member.id).bind(key).bind(id).bind(&input.channel_id).fetch_optional(&mut *tx).await?;
    let (intent, status) = if let Some(row) = existing {
        if row.get::<String, _>("payload_hash") != hash
            || row.get::<serde_json::Value, _>("package") != package
        {
            return Err(Error::Conflict(
                "The submission key or reviewed package changed. Request a fresh review.",
            ));
        }
        (row.get::<Uuid, _>("id"), row.get::<String, _>("status"))
    } else {
        let intent = Uuid::now_v7();
        sqlx::query("INSERT INTO complaint_intents(id,owner_id,report_id,submission_key,payload_hash,channel_id,status,package,rules_version) VALUES($1,$2,$3,$4,$5,$6,'prepared',$7,$8)")
            .bind(intent).bind(member.id).bind(id).bind(key).bind(hash).bind(&input.channel_id).bind(package).bind(COMMUNITY_RULES_VERSION).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'prepare_complaint',$2,jsonb_build_object('intentId',$3::text,'channelId',$4::text,'consent',true))")
            .bind(member.id).bind(id).bind(intent.to_string()).bind(&input.channel_id).execute(&mut *tx).await?;
        (intent, "prepared".into())
    };
    tx.commit().await?;
    Ok(Json(ComplaintPackage {
        id: intent.to_string(),
        report_id: id.to_string(),
        status,
        channel: review.channel,
        text: review.text,
        photos_base64: photos,
    }))
}
pub async fn handoff(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Json(input): Json<HandoffInput>,
) -> Result<Json<ComplaintRecord>, Error> {
    let row = sqlx::query(
        "SELECT report_id,channel_id,package FROM complaint_intents WHERE id=$1 AND owner_id=$2",
    )
    .bind(id)
    .bind(member.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(Error::NotFound)?;
    if !input.consent {
        return Err(Error::Invalid(
            "Confirm that you will review and submit the official form yourself.",
        ));
    }
    let report: Uuid = row.get("report_id");
    let channel: String = row.get("channel_id");
    let (current, _) = snapshot(&state, member.id, report, &channel).await?;
    if row.get::<serde_json::Value, _>("package")
        != serde_json::to_value(current).map_err(|_| Error::Internal)?
    {
        return Err(Error::Conflict(
            "The destination or reviewed content changed. Prepare and review it again.",
        ));
    }
    let mut tx = state.pool.begin().await?;
    let changed=sqlx::query("UPDATE complaint_intents SET status='handoff_requested',updated_at=now() WHERE id=$1 AND owner_id=$2 AND status='prepared'").bind(id).bind(member.id).execute(&mut *tx).await?;
    if changed.rows_affected() > 0 {
        sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'request_complaint_handoff',$2,jsonb_build_object('intentId',$3::text))").bind(member.id).bind(report).bind(id.to_string()).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(ComplaintRecord {
        id: id.to_string(),
        channel_id: channel,
        status: "handoff_requested".into(),
    }))
}
