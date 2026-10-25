use crate::{
    auth::{Member, Moderator},
    contracts::COMMUNITY_RULES_VERSION,
    error::Error,
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum CivicKind {
    Request,
    Poll,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum CivicTopic {
    General,
    Environment,
    Transport,
    PublicSafety,
    Governance,
    Other,
}
impl CivicTopic {
    fn as_str(self) -> &'static str {
        match self {
            Self::General => "general",
            Self::Environment => "environment",
            Self::Transport => "transport",
            Self::PublicSafety => "public_safety",
            Self::Governance => "governance",
            Self::Other => "other",
        }
    }
}
#[derive(Serialize, TS)]
pub struct CivicTopicOption {
    id: CivicTopic,
    label: String,
}
pub fn topic_options() -> Vec<CivicTopicOption> {
    [
        (CivicTopic::General, "Community"),
        (CivicTopic::Environment, "Environment"),
        (CivicTopic::Transport, "Transport"),
        (CivicTopic::PublicSafety, "Safety"),
        (CivicTopic::Governance, "Government"),
        (CivicTopic::Other, "Other"),
    ]
    .into_iter()
    .map(|(id, label)| CivicTopicOption {
        id,
        label: label.into(),
    })
    .collect()
}
pub async fn topics(_member: Member) -> Json<Vec<CivicTopicOption>> {
    Json(topic_options())
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicAccess {
    can_moderate: bool,
}

pub async fn access(
    State(state): State<Arc<AppState>>,
    member: Member,
) -> Result<Json<CivicAccess>, Error> {
    let can_moderate = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role='moderator')",
    )
    .bind(member.id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(CivicAccess { can_moderate }))
}

impl CivicKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Request => "request",
            Self::Poll => "poll",
        }
    }
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CivicCardInput {
    pub kind: CivicKind,
    pub title: String,
    pub body: String,
    pub country_code: String,
    pub locality: String,
    pub closes_at: String,
    pub rules_version: String,
    pub consent: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub topic: Option<CivicTopic>,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicCard {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub web_share_supported: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub topic: Option<CivicTopic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub watching: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub discussion_count: Option<u32>,
    pub id: String,
    pub kind: CivicKind,
    pub title: String,
    pub body: String,
    pub country_code: String,
    pub locality: String,
    pub closes_at: String,
    pub created_at: String,
    pub status: String,
    pub author_nickname: String,
    pub mine: bool,
    pub closed: bool,
    pub my_response: Option<CivicChoice>,
    pub results: Option<CivicResults>,
    pub can_review: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum CivicChoice {
    Yes,
    No,
    DontKnow,
}
impl CivicChoice {
    fn as_str(self) -> &'static str {
        match self {
            Self::Yes => "yes",
            Self::No => "no",
            Self::DontKnow => "dont_know",
        }
    }
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CivicResponseInput {
    pub choice: Option<CivicChoice>,
    pub rules_version: String,
    pub consent: bool,
}

#[derive(Debug, Serialize, TS)]
pub struct CivicResult {
    count: u32,
    percent: f64,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicResults {
    total: u32,
    yes: CivicResult,
    no: CivicResult,
    dont_know: CivicResult,
}

fn result(count: u32, total: u32) -> CivicResult {
    CivicResult {
        count,
        percent: if total == 0 {
            0.0
        } else {
            (f64::from(count) * 1000.0 / f64::from(total)).round() / 10.0
        },
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PageQuery {
    before: Option<String>,
    kind: Option<CivicKind>,
    #[serde(default)]
    mine: bool,
    limit: Option<i64>,
    topic: Option<CivicTopic>,
    state: Option<CivicFeedState>,
    sort: Option<CivicSort>,
    q: Option<String>,
    country_code: Option<String>,
    #[serde(default)]
    watching: bool,
    #[serde(default)]
    participated: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CivicSort {
    #[default]
    Newest,
    ClosingSoon,
}
#[derive(Debug, Clone, Copy, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum CivicFeedState {
    All,
    Open,
    Closed,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DeadlineCursor {
    id: Uuid,
    closes_at: String,
}

fn plain_cursor(before: Option<&str>) -> Result<Option<Uuid>, Error> {
    before
        .map(|s| Uuid::parse_str(s).map_err(|_| Error::Invalid("Invalid community cursor.")))
        .transpose()
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicCardPage {
    items: Vec<CivicCard>,
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum CivicReviewDecision {
    Approve,
    Reject,
    Hide,
}

#[derive(Debug, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct CivicReviewInput {
    decision: CivicReviewDecision,
}

fn validate(input: &CivicCardInput) -> Result<OffsetDateTime, Error> {
    if !input.consent || input.rules_version != COMMUNITY_RULES_VERSION {
        return Err(Error::Invalid(
            "Read and accept the current community rules.",
        ));
    }
    if !(10..=180).contains(&input.title.trim().chars().count())
        || !(20..=4000).contains(&input.body.trim().chars().count())
        || !(2..=120).contains(&input.locality.trim().chars().count())
        || input.country_code.len() != 2
        || !input.country_code.bytes().all(|b| b.is_ascii_uppercase())
        || [&input.title, &input.body, &input.locality]
            .iter()
            .any(|s| s.chars().any(|c| c.is_control() && c != '\n'))
    {
        return Err(Error::Invalid(
            "Add a clear title, a 20–4000 character request and a valid country and locality.",
        ));
    }
    OffsetDateTime::parse(&input.closes_at, &Rfc3339)
        .map_err(|_| Error::Invalid("Choose a valid closing date and time."))
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    member: Member,
    headers: HeaderMap,
    Json(input): Json<CivicCardInput>,
) -> Result<Json<CivicCard>, Error> {
    let key = headers
        .get("idempotency-key")
        .and_then(|s| s.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(Error::Invalid("A unique submission key is required."))?;
    let closes = validate(&input)?;
    let hash = crate::auth::hash(&serde_json::to_string(&input).map_err(|_| Error::Internal)?);
    let existing = sqlx::query(
        "SELECT id,payload_hash FROM community_cards WHERE owner_id=$1 AND submission_key=$2",
    )
    .bind(member.id)
    .bind(key)
    .fetch_optional(&state.pool)
    .await?;
    if let Some(row) = existing {
        if row.get::<String, _>("payload_hash") != hash {
            return Err(Error::Conflict(
                "Submission key was already used for different content.",
            ));
        }
        return Ok(Json(read(&state, member.id, row.get("id")).await?));
    }
    let now = OffsetDateTime::now_utc();
    if closes < now + Duration::minutes(5) || closes > now + Duration::days(365) {
        return Err(Error::Invalid(
            "Choose a deadline between five minutes and one year from now.",
        ));
    }
    crate::content_safety::check_publication(
        &state,
        &format!("{}\n{}\n{}", input.title, input.body, input.locality),
    )
    .await?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,12))")
        .bind(member.id.to_string())
        .execute(&mut *tx)
        .await?;
    let existing = sqlx::query(
        "SELECT id,payload_hash FROM community_cards WHERE owner_id=$1 AND submission_key=$2",
    )
    .bind(member.id)
    .bind(key)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(row) = existing {
        if row.get::<String, _>("payload_hash") != hash {
            return Err(Error::Conflict(
                "Submission key was already used for different content.",
            ));
        }
        let id = row.get("id");
        tx.commit().await?;
        return Ok(Json(read(&state, member.id, id).await?));
    }
    let recent:i64=sqlx::query_scalar("SELECT count(*) FROM community_cards WHERE owner_id=$1 AND created_at>clock_timestamp()-interval '24 hours'").bind(member.id).fetch_one(&mut *tx).await?;
    if recent >= 20 {
        return Err(Error::RateLimited(
            "Daily community request limit reached. Please try again later.",
        ));
    }
    sqlx::query("INSERT INTO community_cards(id,owner_id,submission_key,payload_hash,kind,title,body,country_code,locality,closes_at,rules_version,topic) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(owner_id,submission_key) DO NOTHING")
        .bind(Uuid::now_v7()).bind(member.id).bind(key).bind(&hash).bind(input.kind.as_str()).bind(input.title.trim()).bind(input.body.trim()).bind(&input.country_code).bind(input.locality.trim()).bind(closes).bind(&input.rules_version).bind(input.topic.unwrap_or(CivicTopic::General).as_str()).execute(&mut *tx).await?;
    let row = sqlx::query(
        "SELECT id,payload_hash FROM community_cards WHERE owner_id=$1 AND submission_key=$2",
    )
    .bind(member.id)
    .bind(key)
    .fetch_one(&mut *tx)
    .await?;
    if row.get::<String, _>("payload_hash") != hash {
        return Err(Error::Conflict(
            "Submission key was already used for different content.",
        ));
    }
    let id: Uuid = row.get("id");
    sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,'create_community_card',jsonb_build_object('cardId',$2::text))")
        .bind(member.id).bind(id.to_string()).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(read(&state, member.id, id).await?))
}

async fn read(state: &AppState, user: Uuid, id: Uuid) -> Result<CivicCard, Error> {
    load(state, user, Some(id), &PageQuery::default(), false)
        .await?
        .items
        .into_iter()
        .next()
        .ok_or(Error::NotFound)
}

async fn load(
    state: &AppState,
    user: Uuid,
    id: Option<Uuid>,
    query: &PageQuery,
    moderation: bool,
) -> Result<CivicCardPage, Error> {
    let limit = query.limit.unwrap_or(20);
    if !(1..=50).contains(&limit)
        || query
            .q
            .as_ref()
            .is_some_and(|q| q.chars().count() > 80 || q.chars().any(char::is_control))
        || query
            .country_code
            .as_ref()
            .is_some_and(|c| c.len() != 2 || !c.bytes().all(|b| b.is_ascii_uppercase()))
    {
        return Err(Error::Invalid("Choose a page size between 1 and 50."));
    }
    let soon = query.sort.unwrap_or_default() == CivicSort::ClosingSoon;
    let (cursor, deadline) = match &query.before {
        None => (None, None),
        Some(before) if before.len() > 512 => {
            return Err(Error::Invalid("Invalid community cursor."))
        }
        Some(before) if !soon => (
            Some(Uuid::parse_str(before).map_err(|_| Error::Invalid("Invalid community cursor."))?),
            None,
        ),
        Some(before) => {
            let bytes = URL_SAFE_NO_PAD
                .decode(before)
                .map_err(|_| Error::Invalid("Invalid deadline cursor."))?;
            let value: DeadlineCursor = serde_json::from_slice(&bytes)
                .map_err(|_| Error::Invalid("Invalid deadline cursor."))?;
            let time = OffsetDateTime::parse(&value.closes_at, &Rfc3339)
                .map_err(|_| Error::Invalid("Invalid deadline cursor."))?;
            (Some(value.id), Some(time))
        }
    };
    let lifecycle = match query.state.unwrap_or(CivicFeedState::All) {
        CivicFeedState::All => "all",
        CivicFeedState::Open => "open",
        CivicFeedState::Closed => "closed",
    };
    let rows=sqlx::query(r#"SELECT c.id,c.kind,c.title,c.body,c.topic,c.country_code,c.locality,c.closes_at,c.created_at,c.status,u.nickname,
        c.owner_id=$2 AS mine,c.closes_at<=statement_timestamp() AS closed,
        c.owner_id<>$2 AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=$2 AND role='moderator') AS can_review,
        r.choice AS my_response,w.card_id IS NOT NULL AS watching,
        (SELECT count(*) FROM community_opinions o WHERE o.card_id=c.id AND o.status='approved' AND ($3 OR community_users_visible($2,o.owner_id))) AS discussion_count,
        s.total,s.yes,s.no,s.dont_know
        FROM community_cards c JOIN users u ON u.id=c.owner_id
        LEFT JOIN community_responses r ON r.card_id=c.id AND r.user_id=$2
        LEFT JOIN community_watches w ON w.card_id=c.id AND w.user_id=$2
        LEFT JOIN LATERAL(SELECT count(*) AS total,count(*) FILTER(WHERE choice='yes') AS yes,count(*) FILTER(WHERE choice='no') AS no,count(*) FILTER(WHERE choice='dont_know') AS dont_know
            FROM community_responses WHERE card_id=c.id AND c.status='approved' AND (c.kind='request' OR c.closes_at<=statement_timestamp())) s ON true
        WHERE ($1::uuid IS NULL OR c.id=$1)
        AND ($3 OR c.owner_id=$2 OR c.status='approved' OR ($1::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=$2 AND role='moderator')))
        AND (NOT $3 OR c.status='pending')
        AND ($3 OR ($1::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=$2 AND role='moderator')) OR community_users_visible($2,c.owner_id))
        AND ($4::uuid IS NULL OR (NOT $14 AND c.id<$4) OR ($14 AND (c.closes_at>$15 OR (c.closes_at=$15 AND c.id<$4))))
        AND ($5::text IS NULL OR c.kind=$5) AND (NOT $6 OR c.owner_id=$2)
        AND ($8::text IS NULL OR c.topic=$8)
        AND ($9='all' OR ($9='open' AND c.closes_at>statement_timestamp()) OR ($9='closed' AND c.closes_at<=statement_timestamp()))
        AND ($10='' OR to_tsvector('simple',c.title || ' ' || c.body || ' ' || c.locality) @@ websearch_to_tsquery('simple',$10))
        AND ($11::text IS NULL OR c.country_code=$11)
        AND (NOT $12 OR (c.status='approved' AND w.card_id IS NOT NULL))
        AND (NOT $13 OR r.choice IS NOT NULL)
        ORDER BY CASE WHEN $14 THEN c.closes_at END ASC,c.id DESC LIMIT $7"#)
        .bind(id).bind(user).bind(moderation).bind(cursor).bind(query.kind.map(CivicKind::as_str)).bind(query.mine).bind(limit+1)
        .bind(query.topic.map(CivicTopic::as_str)).bind(lifecycle).bind(query.q.as_deref().unwrap_or("").trim()).bind(&query.country_code)
        .bind(query.watching).bind(query.participated).bind(soon).bind(deadline).fetch_all(&state.pool).await?;
    let mut items = rows
        .into_iter()
        .map(card_from_row)
        .collect::<Result<Vec<_>, _>>()?;
    let next_cursor = if items.len() > limit as usize {
        items.truncate(limit as usize);
        items
            .last()
            .map(|c| {
                if soon {
                    let id = Uuid::parse_str(&c.id).map_err(|_| Error::Internal)?;
                    serde_json::to_vec(&DeadlineCursor {
                        id,
                        closes_at: c.closes_at.clone(),
                    })
                    .map(|bytes| URL_SAFE_NO_PAD.encode(bytes))
                    .map_err(|_| Error::Internal)
                } else {
                    Ok(c.id.clone())
                }
            })
            .transpose()?
    } else {
        None
    };
    Ok(CivicCardPage { items, next_cursor })
}

fn card_from_row(row: sqlx::postgres::PgRow) -> Result<CivicCard, Error> {
    let closed: bool = row.get("closed");
    let kind: String = row.get("kind");
    let results = if row.get::<String, _>("status") == "approved" && (closed || kind == "request") {
        let count =
            |name: &str| u32::try_from(row.get::<i64, _>(name)).map_err(|_| Error::Internal);
        let total = count("total")?;
        Some(CivicResults {
            total,
            yes: result(count("yes")?, total),
            no: result(count("no")?, total),
            dont_know: result(count("dont_know")?, total),
        })
    } else {
        None
    };
    let my_response = row
        .get::<Option<String>, _>("my_response")
        .map(|s| serde_json::from_value(serde_json::Value::String(s)).map_err(|_| Error::Internal))
        .transpose()?;
    Ok(CivicCard {
        web_share_supported: Some(row.get::<String, _>("status") == "approved"),
        topic: Some(
            serde_json::from_value(serde_json::Value::String(row.get("topic")))
                .map_err(|_| Error::Internal)?,
        ),
        watching: Some(row.get("watching")),
        discussion_count: Some(
            u32::try_from(row.get::<i64, _>("discussion_count")).map_err(|_| Error::Internal)?,
        ),
        id: row.get::<Uuid, _>("id").to_string(),
        kind: serde_json::from_value(serde_json::Value::String(row.get("kind")))
            .map_err(|_| Error::Internal)?,
        title: row.get("title"),
        body: row.get("body"),
        country_code: row.get("country_code"),
        locality: row.get("locality"),
        closes_at: row
            .get::<OffsetDateTime, _>("closes_at")
            .format(&Rfc3339)
            .map_err(|_| Error::Internal)?,
        created_at: row
            .get::<OffsetDateTime, _>("created_at")
            .format(&Rfc3339)
            .map_err(|_| Error::Internal)?,
        status: row.get("status"),
        author_nickname: row.get("nickname"),
        mine: row.get("mine"),
        closed,
        my_response,
        results,
        can_review: row.get("can_review"),
    })
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
) -> Result<Json<CivicCard>, Error> {
    Ok(Json(read(&state, member.id, id).await?))
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    member: Member,
    Query(query): Query<PageQuery>,
) -> Result<Json<CivicCardPage>, Error> {
    Ok(Json(load(&state, member.id, None, &query, false).await?))
}

pub async fn moderation_list(
    State(state): State<Arc<AppState>>,
    Moderator(member): Moderator,
    Query(query): Query<PageQuery>,
) -> Result<Json<CivicCardPage>, Error> {
    Ok(Json(load(&state, member.id, None, &query, true).await?))
}

pub async fn review(
    State(state): State<Arc<AppState>>,
    Moderator(member): Moderator,
    Path(id): Path<Uuid>,
    Json(input): Json<CivicReviewInput>,
) -> Result<Json<CivicCard>, Error> {
    let row = sqlx::query(
        "SELECT owner_id,title,body,locality,closes_at FROM community_cards WHERE id=$1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(Error::NotFound)?;
    if row.get::<Uuid, _>("owner_id") == member.id {
        return Err(Error::Forbidden);
    }
    if matches!(input.decision, CivicReviewDecision::Approve) {
        if row.get::<OffsetDateTime, _>("closes_at") <= OffsetDateTime::now_utc() {
            return Err(Error::Conflict("This deadline has passed."));
        }
        crate::content_safety::check_publication(
            &state,
            &format!(
                "{}\n{}\n{}",
                row.get::<String, _>("title"),
                row.get::<String, _>("body"),
                row.get::<String, _>("locality")
            ),
        )
        .await?;
    }
    let status = match input.decision {
        CivicReviewDecision::Approve => "approved",
        CivicReviewDecision::Reject => "rejected",
        CivicReviewDecision::Hide => "hidden",
    };
    let mut tx = state.pool.begin().await?;
    sqlx::query("UPDATE community_cards SET status=$2,reviewed_by=$3,reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1")
        .bind(id).bind(status).bind(member.id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,'review_community_card',jsonb_build_object('cardId',$2::text,'decision',$3::text))")
        .bind(member.id).bind(id.to_string()).bind(status).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(read(&state, member.id, id).await?))
}

pub async fn respond(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Json(input): Json<CivicResponseInput>,
) -> Result<Json<CivicCard>, Error> {
    let mut tx = state.pool.begin().await?;
    let card=sqlx::query("SELECT status,closes_at FROM community_cards WHERE id=$1 AND (owner_id=$2 OR status='approved') AND community_users_visible($2,owner_id) FOR UPDATE").bind(id).bind(member.id).fetch_optional(&mut *tx).await?.ok_or(Error::NotFound)?;
    let now: OffsetDateTime = sqlx::query_scalar("SELECT clock_timestamp()")
        .fetch_one(&mut *tx)
        .await?;
    if card.get::<String, _>("status") != "approved"
        || card.get::<OffsetDateTime, _>("closes_at") <= now
    {
        return Err(Error::Conflict("This request is not open for responses."));
    }
    if input.choice.is_some() && (!input.consent || input.rules_version != COMMUNITY_RULES_VERSION)
    {
        return Err(Error::Invalid(
            "Confirm your response and accept the current community rules.",
        ));
    }
    let changed = if let Some(choice) = input.choice {
        sqlx::query("INSERT INTO community_responses(card_id,user_id,choice,rules_version) VALUES($1,$2,$3,$4) ON CONFLICT(card_id,user_id) DO UPDATE SET choice=EXCLUDED.choice,rules_version=EXCLUDED.rules_version,updated_at=clock_timestamp() WHERE community_responses.choice IS DISTINCT FROM EXCLUDED.choice OR community_responses.rules_version IS DISTINCT FROM EXCLUDED.rules_version")
            .bind(id).bind(member.id).bind(choice.as_str()).bind(&input.rules_version).execute(&mut *tx).await?.rows_affected()
    } else {
        sqlx::query("DELETE FROM community_responses WHERE card_id=$1 AND user_id=$2")
            .bind(id)
            .bind(member.id)
            .execute(&mut *tx)
            .await?
            .rows_affected()
    };
    if changed > 0 {
        sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,'respond_community_card',jsonb_build_object('cardId',$2::text))")
            .bind(member.id).bind(id.to_string()).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(read(&state, member.id, id).await?))
}

#[derive(Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct CivicWatchInput {
    watching: bool,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicWatchState {
    card_id: String,
    watching: bool,
}

pub async fn watch(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Json(input): Json<CivicWatchInput>,
) -> Result<Json<CivicWatchState>, Error> {
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,15))")
        .bind(member.id.to_string())
        .execute(&mut *tx)
        .await?;
    let changed = if input.watching {
        let visible: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM community_cards WHERE id=$1 AND status='approved' AND community_users_visible($2,owner_id))",
        )
        .bind(id)
        .bind(member.id)
        .fetch_one(&mut *tx)
        .await?;
        if !visible {
            return Err(Error::NotFound);
        }
        let existing: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM community_watches WHERE card_id=$1 AND user_id=$2)",
        )
        .bind(id)
        .bind(member.id)
        .fetch_one(&mut *tx)
        .await?;
        if existing {
            0
        } else {
            let count: i64 =
                sqlx::query_scalar("SELECT count(*) FROM community_watches WHERE user_id=$1")
                    .bind(member.id)
                    .fetch_one(&mut *tx)
                    .await?;
            if count >= 1000 {
                return Err(Error::RateLimited(
                    "Your saved-card list is full. Remove a saved card before adding another.",
                ));
            }
            sqlx::query("INSERT INTO community_watches(card_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING").bind(id).bind(member.id).execute(&mut *tx).await?.rows_affected()
        }
    } else {
        sqlx::query("DELETE FROM community_watches WHERE card_id=$1 AND user_id=$2")
            .bind(id)
            .bind(member.id)
            .execute(&mut *tx)
            .await?
            .rows_affected()
    };
    if changed > 0 {
        sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,$2,jsonb_build_object('cardId',$3::text))").bind(member.id).bind(if input.watching{"watch_community_card"}else{"unwatch_community_card"}).bind(id.to_string()).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(CivicWatchState {
        card_id: id.to_string(),
        watching: input.watching,
    }))
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CivicOpinionInput {
    pub text: String,
    pub rules_version: String,
    pub consent: bool,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicOpinion {
    id: String,
    card_id: String,
    text: String,
    author_nickname: String,
    status: String,
    created_at: String,
    mine: bool,
    can_review: bool,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicOpinionPage {
    items: Vec<CivicOpinion>,
    next_cursor: Option<String>,
}

fn opinion_from_row(row: sqlx::postgres::PgRow) -> Result<CivicOpinion, Error> {
    Ok(CivicOpinion {
        id: row.get::<Uuid, _>("id").to_string(),
        card_id: row.get::<Uuid, _>("card_id").to_string(),
        text: row.get("text"),
        author_nickname: row.get("nickname"),
        status: row.get("status"),
        created_at: row
            .get::<OffsetDateTime, _>("created_at")
            .format(&Rfc3339)
            .map_err(|_| Error::Internal)?,
        mine: row.get("mine"),
        can_review: row.get("can_review"),
    })
}

async fn load_opinions(
    state: &AppState,
    user: Uuid,
    card: Uuid,
    opinion: Option<Uuid>,
    query: &PageQuery,
    moderation: bool,
) -> Result<CivicOpinionPage, Error> {
    read(state, user, card).await?;
    let limit = query.limit.unwrap_or(20);
    if !(1..=50).contains(&limit) {
        return Err(Error::Invalid("Choose a page size between 1 and 50."));
    }
    let rows=sqlx::query("SELECT o.id,o.card_id,o.text,o.status,o.created_at,u.nickname,o.owner_id=$2 AS mine,o.owner_id<>$2 AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=$2 AND role='moderator') AS can_review FROM community_opinions o JOIN users u ON u.id=o.owner_id WHERE o.card_id=$1 AND (o.owner_id=$2 OR o.status='approved' OR $3 OR ($4::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=$2 AND role='moderator'))) AND ($3 OR ($4::uuid IS NOT NULL AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=$2 AND role='moderator')) OR community_users_visible($2,o.owner_id)) AND ($4::uuid IS NULL OR o.id=$4) AND ($5::uuid IS NULL OR o.id<$5) AND (NOT $3 OR o.status='pending') ORDER BY o.id DESC LIMIT $6")
        .bind(card).bind(user).bind(moderation).bind(opinion).bind(plain_cursor(query.before.as_deref())?).bind(limit+1).fetch_all(&state.pool).await?;
    let mut items = rows
        .into_iter()
        .map(opinion_from_row)
        .collect::<Result<Vec<_>, _>>()?;
    let next_cursor = if items.len() > limit as usize {
        items.truncate(limit as usize);
        items.last().map(|o| o.id.clone())
    } else {
        None
    };
    Ok(CivicOpinionPage { items, next_cursor })
}

pub async fn opinions(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Query(query): Query<PageQuery>,
) -> Result<Json<CivicOpinionPage>, Error> {
    Ok(Json(
        load_opinions(&state, member.id, id, None, &query, false).await?,
    ))
}

pub async fn moderation_opinions(
    State(state): State<Arc<AppState>>,
    Moderator(member): Moderator,
    Path(id): Path<Uuid>,
    Query(query): Query<PageQuery>,
) -> Result<Json<CivicOpinionPage>, Error> {
    Ok(Json(
        load_opinions(&state, member.id, id, None, &query, true).await?,
    ))
}

pub async fn add_opinion(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(input): Json<CivicOpinionInput>,
) -> Result<Json<CivicOpinion>, Error> {
    read(&state, member.id, id).await?;
    let key = headers
        .get("idempotency-key")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(Error::Invalid("A unique submission key is required."))?;
    if !input.consent
        || input.rules_version != COMMUNITY_RULES_VERSION
        || !(10..=1000).contains(&input.text.trim().chars().count())
        || input.text.chars().any(|c| c.is_control() && c != '\n')
    {
        return Err(Error::Invalid(
            "Write 10–1000 respectful characters and confirm the community rules.",
        ));
    }
    let hash =
        crate::auth::hash(&serde_json::to_string(&(id, &input)).map_err(|_| Error::Internal)?);
    let existing = sqlx::query(
        "SELECT id,payload_hash FROM community_opinions WHERE owner_id=$1 AND submission_key=$2",
    )
    .bind(member.id)
    .bind(key)
    .fetch_optional(&state.pool)
    .await?;
    if let Some(row) = existing {
        if row.get::<String, _>("payload_hash") != hash {
            return Err(Error::Conflict(
                "Submission key was already used for another opinion.",
            ));
        }
        let page = load_opinions(
            &state,
            member.id,
            id,
            Some(row.get("id")),
            &PageQuery::default(),
            false,
        )
        .await?;
        return Ok(Json(page.items.into_iter().next().ok_or(Error::NotFound)?));
    }
    crate::content_safety::check_publication(&state, &input.text).await?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,12))")
        .bind(member.id.to_string())
        .execute(&mut *tx)
        .await?;
    let existing = sqlx::query(
        "SELECT id,payload_hash FROM community_opinions WHERE owner_id=$1 AND submission_key=$2",
    )
    .bind(member.id)
    .bind(key)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(row) = existing {
        if row.get::<String, _>("payload_hash") != hash {
            return Err(Error::Conflict(
                "Submission key was already used for another opinion.",
            ));
        }
        let opinion = row.get("id");
        tx.commit().await?;
        return Ok(Json(
            load_opinions(
                &state,
                member.id,
                id,
                Some(opinion),
                &PageQuery::default(),
                false,
            )
            .await?
            .items
            .into_iter()
            .next()
            .ok_or(Error::NotFound)?,
        ));
    }
    let recent:i64=sqlx::query_scalar("SELECT count(*) FROM community_opinions WHERE owner_id=$1 AND created_at>clock_timestamp()-interval '24 hours'").bind(member.id).fetch_one(&mut *tx).await?;
    if recent >= 60 {
        return Err(Error::RateLimited(
            "Daily opinion limit reached. Please try again later.",
        ));
    }
    let card = sqlx::query("SELECT status,closes_at FROM community_cards WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    let now: OffsetDateTime = sqlx::query_scalar("SELECT clock_timestamp()")
        .fetch_one(&mut *tx)
        .await?;
    if card.get::<String, _>("status") != "approved"
        || card.get::<OffsetDateTime, _>("closes_at") <= now
    {
        return Err(Error::Conflict("This request is not open for opinions."));
    }
    sqlx::query("INSERT INTO community_opinions(id,card_id,owner_id,submission_key,payload_hash,text,rules_version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,submission_key) DO NOTHING")
        .bind(Uuid::now_v7()).bind(id).bind(member.id).bind(key).bind(&hash).bind(input.text.trim()).bind(&input.rules_version).execute(&mut *tx).await?;
    let row = sqlx::query(
        "SELECT id,payload_hash FROM community_opinions WHERE owner_id=$1 AND submission_key=$2",
    )
    .bind(member.id)
    .bind(key)
    .fetch_one(&mut *tx)
    .await?;
    if row.get::<String, _>("payload_hash") != hash {
        return Err(Error::Conflict(
            "Submission key was already used for another opinion.",
        ));
    }
    let opinion: Uuid = row.get("id");
    sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,'create_community_opinion',jsonb_build_object('cardId',$2::text,'opinionId',$3::text))")
        .bind(member.id).bind(id.to_string()).bind(opinion.to_string()).execute(&mut *tx).await?;
    tx.commit().await?;
    let page = load_opinions(
        &state,
        member.id,
        id,
        Some(opinion),
        &PageQuery::default(),
        false,
    )
    .await?;
    Ok(Json(page.items.into_iter().next().ok_or(Error::NotFound)?))
}

pub async fn review_opinion(
    State(state): State<Arc<AppState>>,
    Moderator(member): Moderator,
    Path((card, id)): Path<(Uuid, Uuid)>,
    Json(input): Json<CivicReviewInput>,
) -> Result<Json<CivicOpinion>, Error> {
    let row =
        sqlx::query("SELECT owner_id,text FROM community_opinions WHERE id=$1 AND card_id=$2")
            .bind(id)
            .bind(card)
            .fetch_optional(&state.pool)
            .await?
            .ok_or(Error::NotFound)?;
    if row.get::<Uuid, _>("owner_id") == member.id {
        return Err(Error::Forbidden);
    }
    if matches!(input.decision, CivicReviewDecision::Approve) {
        crate::content_safety::check_publication(&state, &row.get::<String, _>("text")).await?;
    }
    let status = match input.decision {
        CivicReviewDecision::Approve => "approved",
        CivicReviewDecision::Reject => "rejected",
        CivicReviewDecision::Hide => "hidden",
    };
    let mut tx = state.pool.begin().await?;
    sqlx::query("UPDATE community_opinions SET status=$2,reviewed_by=$3,reviewed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1").bind(id).bind(status).bind(member.id).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO audit_events(actor_id,action,details) VALUES($1,'review_community_opinion',jsonb_build_object('cardId',$2::text,'opinionId',$3::text,'decision',$4::text))")
        .bind(member.id).bind(card.to_string()).bind(id.to_string()).bind(status).execute(&mut *tx).await?;
    tx.commit().await?;
    let page = load_opinions(
        &state,
        member.id,
        card,
        Some(id),
        &PageQuery::default(),
        false,
    )
    .await?;
    Ok(Json(page.items.into_iter().next().ok_or(Error::NotFound)?))
}

#[derive(Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum CivicFlagReason {
    Privacy,
    Harassment,
    Misleading,
    Other,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CivicFlagInput {
    reason: CivicFlagReason,
    #[serde(default)]
    #[ts(optional)]
    opinion_id: Option<String>,
}

pub async fn flag(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Json(input): Json<CivicFlagInput>,
) -> Result<Json<serde_json::Value>, Error> {
    read(&state, member.id, id).await?;
    let reason = serde_json::to_value(input.reason).map_err(|_| Error::Internal)?;
    let reason = reason.as_str().ok_or(Error::Internal)?;
    if let Some(opinion) = input.opinion_id {
        let opinion =
            Uuid::parse_str(&opinion).map_err(|_| Error::Invalid("Choose a valid opinion."))?;
        if load_opinions(
            &state,
            member.id,
            id,
            Some(opinion),
            &PageQuery::default(),
            false,
        )
        .await?
        .items
        .is_empty()
        {
            return Err(Error::NotFound);
        }
        sqlx::query("INSERT INTO community_opinion_flags(id,opinion_id,reporter_id,reason) VALUES($1,$2,$3,$4) ON CONFLICT(opinion_id,reporter_id) DO NOTHING")
            .bind(Uuid::now_v7()).bind(opinion).bind(member.id).bind(reason).execute(&state.pool).await?;
    } else {
        sqlx::query("INSERT INTO community_flags(id,card_id,reporter_id,reason) VALUES($1,$2,$3,$4) ON CONFLICT(card_id,reporter_id) DO NOTHING")
            .bind(Uuid::now_v7()).bind(id).bind(member.id).bind(reason).execute(&state.pool).await?;
    }
    Ok(Json(serde_json::json!({"received":true})))
}

pub async fn flags(
    State(state): State<Arc<AppState>>,
    _moderator: Moderator,
    Query(query): Query<PageQuery>,
) -> Result<Json<serde_json::Value>, Error> {
    let limit = query.limit.unwrap_or(20);
    if !(1..=50).contains(&limit) {
        return Err(Error::Invalid("Choose a page size between 1 and 50."));
    }
    let rows=sqlx::query("SELECT id,card_id,opinion_id,reason,created_at FROM (SELECT id,card_id,NULL::uuid AS opinion_id,reason,created_at FROM community_flags UNION ALL SELECT f.id,o.card_id,f.opinion_id,f.reason,f.created_at FROM community_opinion_flags f JOIN community_opinions o ON o.id=f.opinion_id) flags WHERE ($1::uuid IS NULL OR id<$1) ORDER BY id DESC LIMIT $2").bind(plain_cursor(query.before.as_deref())?).bind(limit+1).fetch_all(&state.pool).await?;
    let mut items = Vec::new();
    for row in rows {
        items.push(serde_json::json!({"id":row.get::<Uuid,_>("id").to_string(),"cardId":row.get::<Uuid,_>("card_id").to_string(),"opinionId":row.get::<Option<Uuid>,_>("opinion_id").map(|id|id.to_string()),"reason":row.get::<String,_>("reason"),"createdAt":row.get::<OffsetDateTime,_>("created_at").format(&Rfc3339).map_err(|_|Error::Internal)?}));
    }
    let next_cursor = if items.len() > limit as usize {
        items.truncate(limit as usize);
        items
            .last()
            .and_then(|i| i["id"].as_str())
            .map(str::to_string)
    } else {
        None
    };
    Ok(Json(
        serde_json::json!({"items":items,"nextCursor":next_cursor}),
    ))
}
