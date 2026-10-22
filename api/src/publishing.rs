use crate::auth::Operator;
use crate::{error::Error, AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Reconcile {
    action: String,
    note: String,
    provider_id: Option<String>,
}

pub async fn reconcile(
    State(state): State<Arc<AppState>>,
    operator: Operator,
    Path(id): Path<Uuid>,
    Json(input): Json<Reconcile>,
) -> Result<Json<serde_json::Value>, Error> {
    if !(10..=500).contains(&input.note.trim().len())
        || !["retry", "published", "failed"].contains(&input.action.as_str())
        || (input.action == "published"
            && input
                .provider_id
                .as_ref()
                .is_none_or(|id| id.is_empty() || id.len() > 128))
    {
        return Err(Error::Invalid("Choose retry, published (with provider reference), or failed, and record a reconciliation note."));
    }
    let mut tx = state.pool.begin().await?;
    let row = sqlx::query("SELECT report_id,status FROM publications WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::NotFound)?;
    let status: String = row.get("status");
    if !["blocked", "failed", "uncertain"].contains(&status.as_str()) {
        return Err(Error::Conflict(
            "Only held, failed or uncertain deliveries can be reconciled.",
        ));
    }
    let status = if input.action == "retry" {
        "queued"
    } else {
        &input.action
    };
    sqlx::query("UPDATE publications SET status=$2,provider_id=$3,reason='Manually reconciled by an operator',attempts=0,next_attempt_at=now(),updated_at=now() WHERE id=$1")
        .bind(id).bind(status).bind(input.provider_id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO audit_events(actor_id,action,report_id,details) VALUES($1,'reconcile_publication',$2,$3)")
        .bind(operator.0.id).bind(row.get::<Uuid,_>("report_id")).bind(json!({"publicationId":id,"action":input.action,"note":input.note})).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"ok":true,"status":status})))
}

enum Outcome {
    Published(String),
    Retry,
    Blocked(&'static str),
    Failed,
    Uncertain,
}

pub async fn tick(state: &AppState) -> Result<bool, Error> {
    let job = sqlx::query("UPDATE publications SET status='sending',attempts=attempts+1,updated_at=now() WHERE id=(SELECT id FROM publications WHERE status='queued' AND next_attempt_at<=now() AND attempts<5 ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,report_id,channel,caption,attempts")
        .fetch_optional(&state.pool).await?;
    let Some(job) = job else {
        return Ok(false);
    };
    let id: Uuid = job.get("id");
    let report_id: Uuid = job.get("report_id");
    let channel: String = job.get("channel");
    let caption: String = job.get("caption");
    let attempts: i32 = job.get("attempts");
    let outcome = if channel != "facebook" {
        Outcome::Blocked("This channel requires an approved platform integration; no post was sent")
    } else if !state.config.publishing_enabled {
        Outcome::Blocked("Live publishing is disabled; no post was sent")
    } else if let (Some(page), Some(token)) = (
        &state.config.facebook_page_id,
        &state.config.secrets.facebook_page_token,
    ) {
        let photo: Vec<u8> =
            sqlx::query_scalar("SELECT photo FROM reports WHERE id=$1 AND approval IS NOT NULL")
                .bind(report_id)
                .fetch_one(&state.pool)
                .await?;
        let part = reqwest::multipart::Part::bytes(photo)
            .file_name("civiclens.jpg")
            .mime_str("image/jpeg")
            .map_err(|_| Error::Internal)?;
        let form = reqwest::multipart::Form::new()
            .part("source", part)
            .text("message", caption)
            .text("published", "true");
        match state
            .http
            .post(format!(
                "https://graph.facebook.com/{}/{}/photos",
                state.config.graph_version, page
            ))
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await
        {
            Err(_) => Outcome::Uncertain,
            Ok(response) if response.status().as_u16() == 429 => Outcome::Retry,
            Ok(response) if response.status().is_server_error() => Outcome::Uncertain,
            Ok(response) if !response.status().is_success() => Outcome::Failed,
            Ok(response) => match response.json::<serde_json::Value>().await {
                Ok(body) => body["post_id"]
                    .as_str()
                    .or_else(|| body["id"].as_str())
                    .map_or(Outcome::Uncertain, |id| Outcome::Published(id.into())),
                Err(_) => Outcome::Uncertain,
            },
        }
    } else {
        Outcome::Blocked("Connect an approved Facebook Page before publishing")
    };
    let (status, reason, provider) = match outcome {
        Outcome::Published(id) => ("published", None, Some(id)),
        Outcome::Retry if attempts < 5 => ("queued", Some("Rate limited; retry scheduled"), None),
        Outcome::Retry => (
            "failed",
            Some("Retry limit reached; manual review required"),
            None,
        ),
        Outcome::Blocked(reason) => ("blocked", Some(reason), None),
        Outcome::Failed => (
            "failed",
            Some("Provider rejected the request; review account permissions"),
            None,
        ),
        Outcome::Uncertain => (
            "uncertain",
            Some("Delivery outcome unknown; check the provider before retrying"),
            None,
        ),
    };
    let delay = 30 * 2_i64.pow(attempts as u32) + i64::from(rand::random::<u8>() % 30);
    let mut tx = state.pool.begin().await?;
    sqlx::query("UPDATE publications SET status=$2,reason=$3,provider_id=$4,next_attempt_at=$5,updated_at=now() WHERE id=$1 AND status='sending'")
        .bind(id).bind(status).bind(reason).bind(provider).bind(OffsetDateTime::now_utc()+Duration::seconds(delay)).execute(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO audit_events(action,report_id,details) VALUES('publication_result',$1,$2)",
    )
    .bind(report_id)
    .bind(json!({"channel":channel,"status":status,"publicationId":id}))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}

pub async fn run(state: Arc<AppState>, mut shutdown: tokio::sync::watch::Receiver<bool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
    loop {
        tokio::select! {
            _ = shutdown.changed() => break,
            _ = interval.tick() => {
                if tick(&state).await.is_err() { tracing::error!(event="publisher_error"); }
                if sqlx::query("UPDATE publications SET status='uncertain',reason='Publisher interrupted; reconcile before retry',updated_at=now() WHERE status='sending' AND updated_at < now()-interval '2 minutes'").execute(&state.pool).await.is_err() {
                    tracing::error!(event="publisher_recovery_error");
                }
            }
        }
    }
}
