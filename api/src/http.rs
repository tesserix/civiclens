use crate::{auth, error::Error, reports, AppState};
use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::{
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tower_http::{
    cors::CorsLayer,
    limit::RequestBodyLimitLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    timeout::TimeoutLayer,
};

async fn rate_limit(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response {
    let address = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|i| i.0.ip().to_string())
        .unwrap_or_else(|| "local-test".into());
    let allowed = {
        let Ok(mut limits) = state.rate_limits.lock() else {
            return Error::Unavailable.into_response();
        };
        limits.retain(|_, (at, _)| at.elapsed() < Duration::from_secs(60));
        if limits.len() >= 4096 && !limits.contains_key(&address) {
            false
        } else {
            let entry = limits.entry(address).or_insert((Instant::now(), 0));
            entry.1 += 1;
            entry.1 <= 60
        }
    };
    if !allowed {
        return Error::RateLimited("Please wait a minute and retry.").into_response();
    }
    next.run(request).await
}

async fn report_bulkhead(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let Ok(_permit) = state.report_slots.clone().try_acquire_owned() else {
        return Error::Unavailable.into_response();
    };
    next.run(request).await
}

async fn protect_response(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response
}

async fn capabilities(State(state): State<Arc<AppState>>) -> Json<crate::contracts::Capabilities> {
    use crate::contracts::{BrokerConfiguration, Capabilities, PublishingCapabilities};
    let config = &state.config;
    Json(Capabilities {
        manual_share_channels: Some(crate::contracts::Channel::ALL.to_vec()),
        profile_editing: Some(true),
        community_discovery: Some(true),
        official_complaint_gateway: Some(true),
        civic_participation: Some(true),
        complaint_preparation: Some(true),
        manual_sharing: Some(true),
        google: config.provider_configured("google"),
        facebook: config.provider_configured("facebook"),
        apple: config.provider_configured("apple"),
        auth: BrokerConfiguration {
            issuer: config.oidc_issuer.clone(),
            organization_id: config.oidc_organization_id.clone(),
            project_id: config.oidc_project_id.clone(),
            ios_client_id: config.oidc_ios_client_id.clone(),
            android_client_id: config.oidc_android_client_id.clone(),
            google_idp_id: config.google_idp_id.clone(),
            facebook_idp_id: config.facebook_idp_id.clone(),
            apple_idp_id: config.apple_idp_id.clone(),
        },
        publishing: PublishingCapabilities {
            facebook: false,
            instagram: false,
            whatsapp: false,
        },
        assist: config.assist_configured(),
        assist_context: true,
        hashtag_selection: true,
        authority_preview: true,
        max_photos: Some(if state.media.is_some() { 5 } else { 1 }),
        community_rules_version: Some(crate::contracts::COMMUNITY_RULES_VERSION.into()),
    })
}

async fn ready(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>, Error> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(json!({"status":"ready"})))
}

pub fn router(state: Arc<AppState>) -> Result<Router, Error> {
    crate::official_complaints::validate_catalogue()?;
    let mut cors = CorsLayer::new()
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            axum::http::HeaderName::from_static("idempotency-key"),
        ]);
    if let Some(origin) = &state.config.allowed_origin {
        cors = cors.allow_origin(
            origin
                .parse::<HeaderValue>()
                .map_err(|_| Error::Invalid("Invalid web origin."))?,
        );
    }
    let routes = Router::new()
        .route("/healthz", get(|| async { Json(json!({"status":"ok"})) }))
        .route("/readyz", get(ready))
        .route("/v1/capabilities", get(capabilities))
        .route("/v1/privacy", get(crate::privacy::privacy))
        .route("/v1/terms", get(crate::privacy::terms))
        .route("/v1/account-deletion", get(crate::privacy::deletion))
        .route("/v1/auth/{provider}/challenge", post(auth::challenge))
        .route("/v1/auth/{provider}", post(auth::login))
        .route("/v1/me", get(auth::me))
        .route(
            "/v1/me/profile",
            get(crate::profile::get)
                .put(crate::profile::save)
                .layer(DefaultBodyLimit::max(2_810_000)),
        )
        .route(
            "/v1/me/profile/sign-in-photo",
            post(crate::profile::import_photo).layer(DefaultBodyLimit::max(2048)),
        )
        .route(
            "/v1/community",
            get(crate::community::list).post(crate::community::create),
        )
        .route("/v1/community/{id}", get(crate::community::get))
        .route("/v1/community/access", get(crate::community::access))
        .route("/v1/community/topics", get(crate::community::topics))
        .route(
            "/v1/community/{id}/share-link",
            post(crate::community_links::share_link).layer(DefaultBodyLimit::max(2048)),
        )
        .route("/community/{id}", get(crate::community_links::landing))
        .route(
            "/.well-known/apple-app-site-association",
            get(crate::community_links::apple_association),
        )
        .route(
            "/.well-known/assetlinks.json",
            get(crate::community_links::android_association),
        )
        .route(
            "/assets/civiclens.png",
            get(crate::community_links::share_image),
        )
        .route(
            "/v1/community/{id}/watch",
            post(crate::community::watch).layer(DefaultBodyLimit::max(2048)),
        )
        .route("/v1/directory/units", get(crate::administrative::list))
        .route(
            "/v1/official-complaints/providers",
            get(crate::official_complaints::list_providers),
        )
        .route(
            "/v1/official-complaints/jurisdictions",
            get(crate::official_complaints::list_jurisdictions),
        )
        .route(
            "/v1/official-complaints/resolve",
            post(crate::official_complaints::resolve).layer(DefaultBodyLimit::max(4096)),
        )
        .route(
            "/v1/official-complaints/requests/{id}",
            get(crate::official_complaints::get_request),
        )
        .route(
            "/v1/reports/{id}/official-complaints",
            get(crate::official_complaints::request_history)
                .post(crate::official_complaints::create_request)
                .layer(DefaultBodyLimit::max(4096)),
        )
        .route(
            "/v1/community/{id}/response",
            post(crate::community::respond),
        )
        .route(
            "/v1/community/{id}/opinions",
            get(crate::community::opinions).post(crate::community::add_opinion),
        )
        .route("/v1/community/{id}/flag", post(crate::community::flag))
        .route(
            "/v1/moderation/community",
            get(crate::community::moderation_list),
        )
        .route(
            "/v1/moderation/community/{id}",
            post(crate::community::review),
        )
        .route(
            "/v1/moderation/community/{id}/opinions",
            get(crate::community::moderation_opinions),
        )
        .route(
            "/v1/moderation/community/{id}/opinions/{opinion_id}",
            post(crate::community::review_opinion),
        )
        .route(
            "/v1/moderation/community/flags",
            get(crate::community::flags),
        )
        .route(
            "/v1/me/deletion-request",
            get(crate::account_deletion::get).post(crate::account_deletion::create),
        )
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/reports", get(reports::list))
        .route("/v1/assist", post(crate::assist::assist))
        .route("/v1/authorities/preview", post(crate::authority::preview))
        .route("/v1/reports/{id}", get(reports::get))
        .route(
            "/v1/reports/{id}/complaints",
            get(crate::complaints::options),
        )
        .route(
            "/v1/complaints/{id}/handoff",
            post(crate::complaints::handoff),
        )
        .route("/v1/moderation/reports", get(reports::moderation_list))
        .route("/v1/moderation/reports/{id}/photo", get(reports::photo))
        .route(
            "/v1/moderation/reports/{id}/photos/{index}",
            get(reports::indexed_photo),
        )
        .route(
            "/v1/moderation/reports/{id}/approve",
            post(reports::approve),
        )
        .route(
            "/v1/operations/publications/{id}/reconcile",
            post(crate::publishing::reconcile),
        )
        .fallback(|| async { Error::NotFound })
        .layer(DefaultBodyLimit::max(8_100_000))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(20),
        ))
        .layer(RequestBodyLimitLayer::new(8_100_000))
        .merge(
            Router::new()
                .route(
                    "/v1/reports/{id}/share-package",
                    post(reports::share_package),
                )
                .route(
                    "/v1/reports/{id}/complaint-package",
                    post(crate::complaints::prepare),
                )
                .layer(DefaultBodyLimit::max(1024))
                .layer(RequestBodyLimitLayer::new(1024))
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(75),
                ))
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    report_bulkhead,
                )),
        )
        .merge(
            Router::new()
                .route("/v1/reports", post(reports::create))
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    report_bulkhead,
                ))
                .layer(DefaultBodyLimit::max(40_100_000))
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(75),
                ))
                .layer(RequestBodyLimitLayer::new(40_100_000)),
        )
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit))
        .layer(middleware::from_fn(protect_response))
        .layer(cors)
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .with_state(state);
    Ok(routes)
}
