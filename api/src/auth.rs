use crate::{
    contracts::{Challenge, LoginInput, Session, User},
    error::Error,
    nickname, AppState,
};
use axum::{
    extract::{FromRequestParts, Path, State},
    http::request::Parts,
    Json,
};
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::sync::Arc;
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use uuid::Uuid;

pub fn hash(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
pub fn opaque() -> String {
    hex::encode(rand::random::<[u8; 32]>())
}

#[derive(Debug)]
pub struct Member {
    pub id: Uuid,
    pub nickname: String,
    pub session_hash: String,
}
impl FromRequestParts<Arc<AppState>> for Member {
    type Rejection = Error;
    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self, Error> {
        let token = parts
            .headers
            .get("authorization")
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.strip_prefix("Session "))
            .filter(|t| t.len() == 64)
            .ok_or(Error::Unauthorized)?;
        let session_hash = hash(token);
        let row = sqlx::query("SELECT u.id, u.nickname FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()")
            .bind(&session_hash).fetch_optional(&state.pool).await?.ok_or(Error::Unauthorized)?;
        Ok(Self {
            id: row.get("id"),
            nickname: row.get("nickname"),
            session_hash,
        })
    }
}

#[derive(Debug)]
pub struct Moderator(pub Member);
#[derive(Debug)]
pub struct Operator(pub Member);
impl FromRequestParts<Arc<AppState>> for Operator {
    type Rejection = Error;
    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self, Error> {
        let member = Member::from_request_parts(parts, state).await?;
        let allowed: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role='operator')",
        )
        .bind(member.id)
        .fetch_one(&state.pool)
        .await?;
        if !allowed {
            return Err(Error::Forbidden);
        }
        Ok(Self(member))
    }
}
impl FromRequestParts<Arc<AppState>> for Moderator {
    type Rejection = Error;
    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self, Error> {
        let member = Member::from_request_parts(parts, state).await?;
        let allowed: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'moderator')",
        )
        .bind(member.id)
        .fetch_one(&state.pool)
        .await?;
        if !allowed {
            return Err(Error::Forbidden);
        }
        Ok(Self(member))
    }
}

pub async fn challenge(
    State(state): State<Arc<AppState>>,
    Path(provider): Path<String>,
) -> Result<Json<Challenge>, Error> {
    if !["google", "facebook", "apple"].contains(&provider.as_str()) {
        return Err(Error::NotFound);
    }
    if !state.config.provider_configured(&provider) {
        return Err(Error::Unavailable);
    }
    let id = Uuid::now_v7();
    let nonce = opaque();
    sqlx::query("DELETE FROM auth_challenges WHERE expires_at < now()")
        .execute(&state.pool)
        .await?;
    sqlx::query("INSERT INTO auth_challenges(id, nonce, provider, expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')")
        .bind(id).bind(&nonce).bind(provider).execute(&state.pool).await?;
    Ok(Json(Challenge {
        id: id.to_string(),
        nonce,
    }))
}

#[derive(Debug, Deserialize)]
struct IdentityClaims {
    #[serde(rename = "urn:zitadel:iam:user:resourceowner:id")]
    organization_id: Option<String>,
    sub: String,
    nonce: Option<String>,
}

async fn verify(
    state: &AppState,
    provider: &str,
    token: &str,
    nonce: &str,
) -> Result<String, Error> {
    if ["google", "facebook", "apple"].contains(&provider) {
        if state.config.oidc_project_id.is_empty() || state.config.oidc_organization_id.is_empty() {
            return Err(Error::Unavailable);
        }
        let header = decode_header(token).map_err(|_| Error::Unauthorized)?;
        if header.alg != Algorithm::RS256 {
            return Err(Error::Unauthorized);
        }
        let keys: JwkSet = state
            .http
            .get(format!("{}/oauth/v2/keys", state.config.oidc_issuer))
            .send()
            .await
            .map_err(|_| Error::Unavailable)?
            .error_for_status()
            .map_err(|_| Error::Unavailable)?
            .json()
            .await
            .map_err(|_| Error::Unavailable)?;
        let key = keys
            .find(header.kid.as_deref().ok_or(Error::Unauthorized)?)
            .ok_or(Error::Unauthorized)?;
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&state.config.oidc_issuer]);
        let audiences: Vec<_> = [
            &state.config.oidc_ios_client_id,
            &state.config.oidc_android_client_id,
        ]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect();
        if audiences.is_empty() {
            return Err(Error::Unavailable);
        }
        validation.set_audience(&audiences);
        validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
        validation.leeway = 30;
        let claims = decode::<IdentityClaims>(
            token,
            &DecodingKey::from_jwk(key).map_err(|_| Error::Unauthorized)?,
            &validation,
        )
        .map_err(|_| Error::Unauthorized)?
        .claims;
        if claims.nonce.as_deref() != Some(nonce)
            || claims.sub.is_empty()
            || claims.organization_id.as_deref() != Some(state.config.oidc_organization_id.as_str())
        {
            return Err(Error::Unauthorized);
        }
        Ok(claims.sub)
    } else {
        Err(Error::NotFound)
    }
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Path(provider): Path<String>,
    Json(input): Json<LoginInput>,
) -> Result<Json<Session>, Error> {
    if input.token.len() > 8192 || input.token.len() < 10 {
        return Err(Error::Invalid("Invalid provider token."));
    }
    let id = Uuid::parse_str(&input.challenge_id).map_err(|_| Error::Unauthorized)?;
    let nonce: String = sqlx::query_scalar(
        "SELECT nonce FROM auth_challenges WHERE id=$1 AND provider=$2 AND expires_at > now()",
    )
    .bind(id)
    .bind(&provider)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(Error::Unauthorized)?;
    let subject = verify(&state, &provider, &input.token, &nonce).await?;
    let mut mac = Hmac::<Sha256>::new_from_slice(state.config.secrets.identity_key.as_bytes())
        .map_err(|_| Error::Internal)?;
    mac.update(format!("{}:{subject}", state.config.oidc_issuer).as_bytes());
    let identity_hash = hex::encode(mac.finalize().into_bytes());
    let mut tx = state.pool.begin().await?;
    let consumed = sqlx::query("DELETE FROM auth_challenges WHERE id=$1 AND expires_at > now()")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if consumed.rows_affected() != 1 {
        return Err(Error::Unauthorized);
    }
    let existing = sqlx::query("SELECT id, nickname FROM users WHERE identity_hash=$1")
        .bind(&identity_hash)
        .fetch_optional(&mut *tx)
        .await?;
    let user = if let Some(row) = existing {
        User {
            id: row.get::<Uuid, _>("id").to_string(),
            nickname: row.get("nickname"),
        }
    } else {
        let nickname = nickname::choose(input.nickname.as_deref())?;
        let user_id = Uuid::now_v7();
        let result = sqlx::query("INSERT INTO users(id,identity_hash,nickname) VALUES($1,$2,$3)")
            .bind(user_id)
            .bind(identity_hash)
            .bind(&nickname)
            .execute(&mut *tx)
            .await;
        if let Err(sqlx::Error::Database(e)) = &result {
            if e.is_unique_violation() {
                return Err(Error::Conflict("Nickname is in use, or this account just signed in. Retry with a different nickname or leave it blank."));
            }
        }
        result?;
        User {
            id: user_id.to_string(),
            nickname,
        }
    };
    sqlx::query("UPDATE users SET identity_subject=$2 WHERE id=$1")
        .bind(Uuid::parse_str(&user.id).map_err(|_| Error::Internal)?)
        .bind(subject)
        .execute(&mut *tx)
        .await?;
    let token = opaque();
    let expires_at = OffsetDateTime::now_utc() + Duration::days(30);
    sqlx::query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)")
        .bind(hash(&token))
        .bind(Uuid::parse_str(&user.id).map_err(|_| Error::Internal)?)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(Session {
        token,
        user,
        expires_at: expires_at.format(&Rfc3339).map_err(|_| Error::Internal)?,
    }))
}

pub async fn me(State(_state): State<Arc<AppState>>, member: Member) -> Json<User> {
    Json(User {
        id: member.id.to_string(),
        nickname: member.nickname,
    })
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    member: Member,
) -> Result<Json<serde_json::Value>, Error> {
    sqlx::query("DELETE FROM sessions WHERE token_hash=$1 AND user_id=$2")
        .bind(member.session_hash)
        .bind(member.id)
        .execute(&state.pool)
        .await?;
    Ok(Json(serde_json::json!({"ok": true})))
}
