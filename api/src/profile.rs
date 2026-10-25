use crate::{auth::Member, error::Error, AppState};
use axum::{extract::State, Json};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AccountProfile {
    pub bio: String,
    pub photo_base64: Option<String>,
    pub sign_in_photo_available: bool,
}

#[derive(Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileInput {
    bio: String,
    #[serde(default)]
    photo_base64: Option<String>,
    #[serde(default)]
    remove_photo: bool,
}

fn profile(row: sqlx::postgres::PgRow) -> AccountProfile {
    AccountProfile {
        bio: row.get("profile_bio"),
        photo_base64: row
            .get::<Option<Vec<u8>>, _>("avatar_jpeg")
            .map(|bytes| STANDARD.encode(bytes)),
        sign_in_photo_available: picture_url(
            row.get::<Option<String>, _>("sign_in_photo_url").as_deref(),
        )
        .is_some(),
    }
}

pub fn picture_url(value: Option<&str>) -> Option<String> {
    let value = value.filter(|value| value.len() <= 2048)?;
    let url = reqwest::Url::parse(value).ok()?;
    if url.scheme() != "https"
        || url.port().is_some_and(|port| port != 443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let allowed = match url.host_str()? {
        "auth.tesserix.app" => url.path().starts_with("/assets/v1/"),
        "lh3.googleusercontent.com"
        | "lh4.googleusercontent.com"
        | "lh5.googleusercontent.com"
        | "lh6.googleusercontent.com" => url.path().len() > 1,
        _ => false,
    };
    allowed.then(|| url.to_string())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportPhotoInput {}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ImportedProfilePhoto {
    pub photo_base64: String,
}

pub async fn import_photo(
    State(state): State<Arc<AppState>>,
    member: Member,
    Json(_input): Json<ImportPhotoInput>,
) -> Result<Json<ImportedProfilePhoto>, Error> {
    let candidate: Option<String> =
        sqlx::query_scalar("SELECT sign_in_photo_url FROM users WHERE id=$1")
            .bind(member.id)
            .fetch_one(&state.pool)
            .await?;
    let url = picture_url(candidate.as_deref()).ok_or(Error::NotFound)?;
    let response = state
        .http
        .get(url)
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|_| Error::Unavailable)?;
    if !response.status().is_success() {
        return Err(Error::Unavailable);
    }
    let bytes = crate::media::bounded(response, 2_097_152).await?;
    let photo = photo(&state, STANDARD.encode(bytes)).await?;
    Ok(Json(ImportedProfilePhoto {
        photo_base64: STANDARD.encode(photo),
    }))
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    member: Member,
) -> Result<Json<AccountProfile>, Error> {
    let row =
        sqlx::query("SELECT profile_bio,avatar_jpeg,sign_in_photo_url FROM users WHERE id=$1")
            .bind(member.id)
            .fetch_optional(&state.pool)
            .await?
            .ok_or(Error::NotFound)?;
    Ok(Json(profile(row)))
}

async fn photo(state: &AppState, encoded: String) -> Result<Vec<u8>, Error> {
    if encoded.len() > 2_800_000 {
        return Err(Error::Invalid("Choose a profile photo smaller than 2 MB."));
    }
    let permit = state
        .photo_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| Error::RateLimited("Photo processing is busy. Please retry."))?;
    let bytes = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        crate::reports::sanitize_photo(&encoded, 256)
    })
    .await
    .map_err(|_| Error::Internal)??;
    if bytes.len() > 98_304 {
        return Err(Error::Invalid("Choose a simpler or smaller profile photo."));
    }
    Ok(bytes)
}

pub async fn save(
    State(state): State<Arc<AppState>>,
    member: Member,
    Json(input): Json<ProfileInput>,
) -> Result<Json<AccountProfile>, Error> {
    let bio = input.bio.trim();
    if bio.chars().count() > 280
        || bio.chars().any(|c| c.is_control() && c != '\n')
        || (input.remove_photo && input.photo_base64.is_some())
    {
        return Err(Error::Invalid(
            "Use a bio of at most 280 characters and choose one photo action.",
        ));
    }
    let replacing = input.remove_photo || input.photo_base64.is_some();
    let bytes = match input.photo_base64 {
        Some(encoded) => Some(photo(&state, encoded).await?),
        None => None,
    };
    let row = sqlx::query("UPDATE users SET profile_bio=$2,avatar_jpeg=CASE WHEN $3 THEN $4 ELSE avatar_jpeg END,updated_at=now() WHERE id=$1 RETURNING profile_bio,avatar_jpeg,sign_in_photo_url")
        .bind(member.id).bind(bio).bind(replacing).bind(bytes).fetch_optional(&state.pool).await?.ok_or(Error::NotFound)?;
    Ok(Json(profile(row)))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sign_in_picture_candidates_accept_only_trusted_https_photo_origins() {
        for url in [
            "https://lh3.googleusercontent.com/a/photo=s96-c",
            "https://auth.tesserix.app/assets/v1/avatar",
        ] {
            assert_eq!(picture_url(Some(url)).as_deref(), Some(url));
        }
        for url in [
            "http://lh3.googleusercontent.com/a/photo",
            "https://127.0.0.1/a",
            "https://169.254.169.254/",
            "https://lh3.googleusercontent.com.evil.test/a",
            "https://user:password@lh3.googleusercontent.com/a",
            "https://lh3.googleusercontent.com:444/a",
            "https://auth.tesserix.app/oauth/v2/token",
            "https://lh3.googleusercontent.com/a?token=private",
            "https://lh3.googleusercontent.com/a#fragment",
            "data:image/png;base64,AA==",
        ] {
            assert!(picture_url(Some(url)).is_none(), "accepted {url}");
        }
        assert!(picture_url(None).is_none());
    }
}
