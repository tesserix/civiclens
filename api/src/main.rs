mod account_deletion;
mod admin;
mod auth;
mod authority;
mod config;
mod contracts;
mod error;
mod http;
mod nickname;
mod privacy;
mod publishing;
mod reports;
#[cfg(test)]
mod tests;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use std::str::FromStr;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Instant,
};

pub struct AppState {
    pool: sqlx::PgPool,
    config: config::Config,
    http: reqwest::Client,
    authorities: Vec<authority::Authority>,
    rate_limits: Mutex<HashMap<String, (Instant, u32)>>,
    photo_slots: Arc<tokio::sync::Semaphore>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("civiclens_api=info")
        .init();
    let config = config::Config::load()?;
    let options = PgConnectOptions::from_str(&config.secrets.database_url)?
        .statement_cache_capacity(0)
        .options([
            ("search_path", "civiclens,pg_catalog"),
            ("statement_timeout", "15000"),
            ("lock_timeout", "3000"),
        ]);
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect_with(options)
        .await?;
    let command = std::env::args().nth(1);
    if command.as_deref() == Some("migrate") {
        sqlx::query("CREATE SCHEMA IF NOT EXISTS civiclens")
            .execute(&pool)
            .await?;
        admin::migrate(&pool, std::path::Path::new("api/migrations")).await?;
        tracing::info!(event = "migration_complete");
        return Ok(());
    }
    if command.as_deref() == Some("grant-role") {
        let user = uuid::Uuid::parse_str(&std::env::args().nth(2).ok_or("user UUID required")?)?;
        let role = std::env::args().nth(3).ok_or("role required")?;
        admin::role(&pool, user, &role).await?;
        tracing::info!(event="role_granted",user_id=%user,role);
        return Ok(());
    }
    if command.is_some() {
        return Err("supported commands: migrate, grant-role; no command starts the API".into());
    }
    let authorities = authority::load(
        &std::env::var("CIVICLENS_AUTHORITIES_FILE")
            .unwrap_or_else(|_| "api/data/authorities.json".into()),
    )?;
    let bind = config.bind.clone();
    let state = Arc::new(AppState {
        pool,
        config,
        authorities,
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .redirect(reqwest::redirect::Policy::none())
            .build()?,
        rate_limits: Mutex::new(HashMap::new()),
        photo_slots: Arc::new(tokio::sync::Semaphore::new(2)),
    });
    let router = http::router(state.clone())?;
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let publisher = tokio::spawn(publishing::run(state, shutdown_rx));
    tracing::info!(event = "api_started", bind);
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        #[cfg(unix)]
        {
            let mut terminate =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                    .expect("install SIGTERM handler");
            tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
        }
        #[cfg(not(unix))]
        {
            tokio::signal::ctrl_c().await.ok();
        }
        shutdown_tx.send(true).ok();
    })
    .await?;
    publisher.await?;
    Ok(())
}
