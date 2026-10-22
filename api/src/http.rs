use crate::{auth, error::Error, reports, AppState};
use axum::{
    extract::{ConnectInfo, Request, State},
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
        return (StatusCode::TOO_MANY_REQUESTS,Json(json!({"code":"RATE_LIMITED","message":"Please wait a minute and retry.","request_id":uuid::Uuid::new_v4().to_string()}))).into_response();
    }
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

async fn capabilities(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let configured = !state.config.oidc_project_id.is_empty()
        && !state.config.oidc_ios_client_id.is_empty()
        && !state.config.oidc_android_client_id.is_empty();
    Json(
        json!({"google":configured && !state.config.google_idp_id.is_empty(),"facebook":configured && !state.config.facebook_idp_id.is_empty(),
        "auth":{"issuer":state.config.oidc_issuer,"projectId":state.config.oidc_project_id,"iosClientId":state.config.oidc_ios_client_id,"androidClientId":state.config.oidc_android_client_id,"googleIdpId":state.config.google_idp_id,"facebookIdpId":state.config.facebook_idp_id},
        "publishing":{"facebook":state.config.publishing_enabled && state.config.facebook_page_id.is_some() && state.config.secrets.facebook_page_token.is_some(),"instagram":false,"whatsapp":false}}),
    )
}

async fn ready(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>, Error> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(json!({"status":"ready"})))
}

pub fn router(state: Arc<AppState>) -> Result<Router, Error> {
    let mut cors = CorsLayer::new()
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
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
        .route("/v1/auth/{provider}/challenge", post(auth::challenge))
        .route("/v1/auth/{provider}", post(auth::login))
        .route("/v1/me", get(auth::me))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/reports", get(reports::list).post(reports::create))
        .route("/v1/reports/{id}", get(reports::get))
        .route("/v1/moderation/reports", get(reports::moderation_list))
        .route("/v1/moderation/reports/{id}/photo", get(reports::photo))
        .route(
            "/v1/moderation/reports/{id}/approve",
            post(reports::approve),
        )
        .route(
            "/v1/operations/publications/{id}/reconcile",
            post(crate::publishing::reconcile),
        )
        .fallback(|| async { Error::NotFound })
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit))
        .layer(middleware::from_fn(protect_response))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(20),
        ))
        .layer(RequestBodyLimitLayer::new(8_100_000))
        .layer(cors)
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .with_state(state);
    Ok(routes)
}
