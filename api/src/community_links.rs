use crate::{auth::Member, error::Error, AppState};
use axum::{
    extract::{Path, State},
    http::header,
    response::{Html, IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::{Arc, OnceLock};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinkSettings {
    pub public_origin: String,
    pub apple_team_id: String,
    pub ios_bundle_id: String,
    pub ios_app_store_id: String,
    pub ios_listing_verified: bool,
    pub android_package_name: String,
    pub android_sha256_cert_fingerprints: Vec<String>,
    pub android_listing_verified: bool,
}
pub fn settings() -> Result<&'static LinkSettings, Error> {
    static SETTINGS: OnceLock<Result<LinkSettings, serde_json::Error>> = OnceLock::new();
    SETTINGS
        .get_or_init(|| serde_json::from_str(include_str!("../../shared/app-links.json")))
        .as_ref()
        .map_err(|_| Error::Internal)
}
pub fn origin(value: Option<String>, production: bool) -> Result<String, Error> {
    let config = settings()?;
    let value = value.unwrap_or_else(|| config.public_origin.clone());
    let u = reqwest::Url::parse(&value)
        .map_err(|_| Error::Invalid("Choose a valid public share origin."))?;
    if u.path() != "/"
        || u.query().is_some()
        || u.fragment().is_some()
        || !u.username().is_empty()
        || u.password().is_some()
    {
        return Err(Error::Invalid(
            "Share origins cannot contain paths, credentials or query parameters.",
        ));
    }
    let canonical = value.trim_end_matches('/');
    let local = !production
        && u.scheme() == "http"
        && matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if canonical != config.public_origin && !local {
        return Err(Error::Invalid(
            "Use the canonical share origin, or loopback for local development.",
        ));
    }
    if config.apple_team_id.len() != 10
        || !config
            .apple_team_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric())
        || config.ios_app_store_id.is_empty()
        || !config.ios_app_store_id.bytes().all(|b| b.is_ascii_digit())
        || config.android_sha256_cert_fingerprints.iter().any(|s| {
            s.len() != 95
                || s.split(':').count() != 32
                || s.split(':')
                    .any(|b| b.len() != 2 || !b.bytes().all(|b| b.is_ascii_hexdigit()))
        })
    {
        return Err(Error::Internal);
    }
    Ok(canonical.to_string())
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CivicShareLink {
    card_id: String,
    url: String,
    text: String,
    open_app_url: String,
    ios_store_url: Option<String>,
    android_store_url: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ShareInput {}
struct PublicCard {
    title: String,
    body: String,
    topic: String,
    place: String,
    deadline: String,
}
async fn public_card(state: &AppState, id: Uuid) -> Result<PublicCard, Error> {
    let row=sqlx::query("SELECT title,body,topic,locality,country_code,closes_at FROM community_cards WHERE id=$1 AND status='approved'")
        .bind(id).fetch_optional(&state.pool).await?.ok_or(Error::NotFound)?;
    Ok(PublicCard {
        title: row.get("title"),
        body: row.get("body"),
        topic: row.get("topic"),
        place: format!(
            "{}, {}",
            row.get::<String, _>("locality"),
            row.get::<String, _>("country_code")
        ),
        deadline: row
            .get::<OffsetDateTime, _>("closes_at")
            .format(&Rfc3339)
            .map_err(|_| Error::Internal)?,
    })
}
fn stores(config: &LinkSettings) -> (Option<String>, Option<String>) {
    (
        config
            .ios_listing_verified
            .then(|| format!("https://apps.apple.com/app/id{}", config.ios_app_store_id)),
        config.android_listing_verified.then(|| {
            format!(
                "https://play.google.com/store/apps/details?id={}",
                config.android_package_name
            )
        }),
    )
}
pub async fn share_link(
    State(state): State<Arc<AppState>>,
    member: Member,
    Path(id): Path<Uuid>,
    Json(_input): Json<ShareInput>,
) -> Result<Json<CivicShareLink>, Error> {
    crate::community_blocks::ensure_card_visible(&state, member.id, id).await?;
    let card = public_card(&state, id).await?;
    crate::content_safety::check_publication(
        &state,
        &format!("{}\n{}\n{}", card.title, card.body, card.place),
    )
    .await?;
    crate::community_blocks::ensure_card_visible(&state, member.id, id).await?;
    let _fresh = public_card(&state, id).await?;
    let url = format!("{}/community/{id}", state.config.community_share_origin);
    let text = format!(
        "{}\n\n{}\n\n{}",
        card.title,
        card.body.chars().take(280).collect::<String>(),
        url
    );
    let (ios_store_url, android_store_url) = stores(settings()?);
    Ok(Json(CivicShareLink {
        card_id: id.to_string(),
        url,
        text,
        open_app_url: format!("civiclens://community/{id}"),
        ios_store_url,
        android_store_url,
    }))
}
fn escape(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&#39;"),
            _ => output.push(c),
        }
    }
    output
}
pub async fn landing(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Response, Error> {
    let card = public_card(&state, id).await?;
    let config = settings()?;
    let canonical = format!("{}/community/{id}", state.config.community_share_origin);
    let image = format!(
        "{}/assets/civiclens.png",
        state.config.community_share_origin
    );
    let open = format!("civiclens://community/{id}");
    let (ios, android) = stores(config);
    let mut downloads = String::new();
    if let Some(url) = ios {
        downloads.push_str(&format!(
            "<a class=\"button secondary\" href=\"{}\">Download for iPhone</a>",
            escape(&url)
        ));
    }
    if let Some(url) = android {
        downloads.push_str(&format!(
            "<a class=\"button secondary\" href=\"{}\">Get it on Google Play</a>",
            escape(&url)
        ));
    }
    if downloads.is_empty() {
        downloads="<p class=\"muted\">Public downloads are not available yet. CivicLens is currently being tested.</p>".into();
    }
    let banner = if config.ios_listing_verified {
        format!(
            "<meta name=\"apple-itunes-app\" content=\"app-id={}, app-argument={}\">",
            config.ios_app_store_id,
            escape(&canonical)
        )
    } else {
        String::new()
    };
    let fields = [
        ("TITLE", escape(&card.title)),
        (
            "DESCRIPTION",
            escape(&card.body.chars().take(200).collect::<String>()),
        ),
        ("BODY", escape(&card.body)),
        ("TOPIC", escape(&card.topic.replace('_', " "))),
        ("PLACE", escape(&card.place)),
        (
            "DEADLINE",
            escape(&format!("Responses close {}", card.deadline)),
        ),
        ("CANONICAL", escape(&canonical)),
        ("IMAGE", escape(&image)),
        ("OPEN", escape(&open)),
        ("STORES", downloads),
        ("BANNER", banner),
    ];
    let mut html = String::new();
    for (index, part) in include_str!("../public/community.html")
        .split("@@")
        .enumerate()
    {
        if index % 2 == 0 {
            html.push_str(part)
        } else {
            html.push_str(
                &fields
                    .iter()
                    .find(|(key, _)| *key == part)
                    .ok_or(Error::Internal)?
                    .1,
            )
        }
    }
    Ok(([(header::CONTENT_SECURITY_POLICY,"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"),(header::REFERRER_POLICY,"no-referrer")],Html(html)).into_response())
}
pub async fn apple_association() -> Result<Json<Value>, Error> {
    let c = settings()?;
    Ok(Json(
        json!({"applinks":{"apps":[],"details":[{"appID":format!("{}.{}",c.apple_team_id,c.ios_bundle_id),"paths":["/community/*"]}]}}),
    ))
}
pub async fn android_association() -> Result<Json<Value>, Error> {
    let c = settings()?;
    Ok(Json(if c.android_sha256_cert_fingerprints.is_empty() {
        json!([])
    } else {
        json!([{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":c.android_package_name,"sha256_cert_fingerprints":c.android_sha256_cert_fingerprints}}])
    }))
}
pub async fn share_image() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "image/png")],
        include_bytes!("../../assets/civiclens-icon.png").as_slice(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn store_actions_require_verified_listings_and_use_the_registered_identifiers() {
        let mut config: LinkSettings =
            serde_json::from_str(include_str!("../../shared/app-links.json")).unwrap();
        config.ios_listing_verified = false;
        config.android_listing_verified = false;
        assert_eq!(stores(&config), (None, None));
        config.ios_listing_verified = true;
        assert_eq!(
            stores(&config),
            (Some("https://apps.apple.com/app/id6825667307".into()), None)
        );
        config.android_listing_verified = true;
        assert_eq!(
            stores(&config).1,
            Some("https://play.google.com/store/apps/details?id=app.tesserix.civiclens".into())
        );
    }

    #[test]
    fn share_origin_rejects_redirects_credentials_and_unverified_hosts() {
        assert_eq!(
            origin(None, true).unwrap(),
            "https://civiclns-api.tesserix.app"
        );
        assert!(origin(Some("http://127.0.0.1:8098".into()), false).is_ok());
        for value in [
            "https://example.org",
            "https://civiclns-api.tesserix.app/evil",
            "https://user:password@civiclns-api.tesserix.app",
            "https://civiclns-api.tesserix.app?redirect=evil",
            "http://127.0.0.1:8098",
        ] {
            assert!(origin(Some(value.into()), true).is_err());
        }
    }
}
