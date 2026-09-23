pub mod agent;
pub mod agent_runner;
pub mod auth;
pub mod error;
pub mod local;
pub mod memory;
pub mod menu;
pub mod models;
pub mod observability;
pub mod profile;
pub mod routes;
pub mod settings;
pub mod state;

use axum::{http::HeaderName, http::HeaderValue, routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use state::Config;
use std::{net::SocketAddr, time::Duration};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub use state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(routes::health))
        .route("/ready", get(routes::ready))
        .merge(routes::api())
        .with_state(state)
        .layer(cors_layer())
        .layer(TraceLayer::new_for_http())
}

pub async fn run() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    let pool = PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&config.database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let app = router(AppState {
        pool,
        jwt_secret: config.jwt_secret,
        owner_email: config.owner_email,
    });
    let address = SocketAddr::new(config.host, config.port);
    tracing::info!("drink server listening on http://{address}");
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn cors_layer() -> CorsLayer {
    let raw_origins = std::env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173".to_owned());
    let origins = raw_origins
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter_map(|value| value.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_headers([
            HeaderName::from_static("authorization"),
            HeaderName::from_static("content-type"),
        ])
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
        ])
}
