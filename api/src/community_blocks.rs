use crate::{auth::Member, error::Error, AppState};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct BlockInput {
    blocked: bool,
}

#[derive(Serialize, TS)]
pub struct BlockState {
    nickname: String,
    blocked: bool,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BlockedUser {
    nickname: String,
    created_at: String,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BlockPage {
    items: Vec<BlockedUser>,
    next_cursor: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PageQuery {
    limit: Option<i64>,
    before: Option<String>,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    member: Member,
    Query(query): Query<PageQuery>,
) -> Result<Json<BlockPage>, Error> {
    let limit = query.limit.unwrap_or(20);
    if !(1..=50).contains(&limit)
        || query
            .before
            .as_ref()
            .is_some_and(|v| v.is_empty() || v.len() > 30)
    {
        return Err(Error::Invalid(
            "Choose a page size between 1 and 50 and a valid cursor.",
        ));
    }
    let rows = sqlx::query("SELECT u.nickname,b.created_at FROM community_user_blocks b JOIN users u ON u.id=b.blocked_user_id WHERE b.blocker_id=$1 AND ($2::text IS NULL OR lower(u.nickname)>lower($2)) ORDER BY lower(u.nickname) LIMIT $3")
        .bind(member.id).bind(&query.before).bind(limit + 1).fetch_all(&state.pool).await?;
    let mut items = rows
        .into_iter()
        .map(|row| {
            Ok(BlockedUser {
                nickname: row.get("nickname"),
                created_at: row
                    .get::<OffsetDateTime, _>("created_at")
                    .format(&Rfc3339)
                    .map_err(|_| Error::Internal)?,
            })
        })
        .collect::<Result<Vec<_>, Error>>()?;
    let next_cursor = if items.len() > limit as usize {
        items.truncate(limit as usize);
        items.last().map(|item| item.nickname.clone())
    } else {
        None
    };
    Ok(Json(BlockPage { items, next_cursor }))
}

pub async fn change(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(nickname): Path<String>,
    Json(input): Json<BlockInput>,
) -> Result<Json<BlockState>, Error> {
    let nickname = crate::nickname::choose(Some(&nickname))?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,16))")
        .bind(member.id.to_string())
        .execute(&mut *tx)
        .await?;
    let target = sqlx::query("SELECT id,nickname FROM users WHERE lower(nickname)=lower($1)")
        .bind(&nickname)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::NotFound)?;
    let target_id: Uuid = target.get("id");
    if target_id == member.id {
        return Err(Error::Invalid("You cannot block your own account."));
    }
    let changed = if input.blocked {
        let existing: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM community_user_blocks WHERE blocker_id=$1 AND blocked_user_id=$2)")
            .bind(member.id).bind(target_id).fetch_one(&mut *tx).await?;
        if existing {
            0
        } else {
            let count: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM community_user_blocks WHERE blocker_id=$1",
            )
            .bind(member.id)
            .fetch_one(&mut *tx)
            .await?;
            if count >= 1000 {
                return Err(Error::RateLimited(
                    "Your block list is full. Remove a block before adding another.",
                ));
            }
            sqlx::query("INSERT INTO community_user_blocks(blocker_id,blocked_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING")
                .bind(member.id).bind(target_id).execute(&mut *tx).await?.rows_affected()
        }
    } else {
        sqlx::query("DELETE FROM community_user_blocks WHERE blocker_id=$1 AND blocked_user_id=$2")
            .bind(member.id)
            .bind(target_id)
            .execute(&mut *tx)
            .await?
            .rows_affected()
    };
    if changed > 0 {
        sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,$2,'{}'::jsonb)")
            .bind(member.id)
            .bind(if input.blocked {
                "block_community_user"
            } else {
                "unblock_community_user"
            })
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(Json(BlockState {
        nickname: target.get("nickname"),
        blocked: input.blocked,
    }))
}

pub async fn ensure_card_visible(state: &AppState, user: Uuid, card: Uuid) -> Result<(), Error> {
    let visible: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM community_cards WHERE id=$1 AND status='approved' AND community_users_visible($2,owner_id))")
        .bind(card).bind(user).fetch_one(&state.pool).await?;
    if visible {
        Ok(())
    } else {
        Err(Error::NotFound)
    }
}
