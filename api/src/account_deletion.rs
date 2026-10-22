use crate::{auth::Member, contracts::DeletionRequest, error::Error, AppState};
use axum::{extract::State, http::StatusCode, Json};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Confirmation {}

const SELECT: &str = "SELECT id::text,status,to_char(requested_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS requested_at,to_char(due_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS due_at,'sales@tesserix.app'::text AS owner FROM account_deletion_requests WHERE user_id=$1";

pub async fn get(
    State(state): State<Arc<AppState>>,
    member: Member,
) -> Result<Json<DeletionRequest>, Error> {
    let request = sqlx::query(SELECT)
        .bind(member.id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error::NotFound)?;
    Ok(Json(receipt(request)))
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    member: Member,
    Json(_input): Json<Confirmation>,
) -> Result<(StatusCode, Json<DeletionRequest>), Error> {
    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO account_deletion_requests(id,user_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING")
        .bind(Uuid::now_v7()).bind(member.id).execute(&mut *tx).await?;
    let request = sqlx::query(SELECT)
        .bind(member.id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok((StatusCode::ACCEPTED, Json(receipt(request))))
}

fn receipt(row: sqlx::postgres::PgRow) -> DeletionRequest {
    DeletionRequest {
        id: row.get("id"),
        status: row.get("status"),
        requested_at: row.get("requested_at"),
        due_at: row.get("due_at"),
        owner: row.get("owner"),
    }
}
