use std::{env, net::IpAddr};

use anyhow::{anyhow, Result};
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub host: IpAddr,
    pub port: u16,
    pub database_url: String,
    pub database_max_connections: u32,
    pub jwt_secret: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let host = env::var("HOST")
            .unwrap_or_else(|_| "0.0.0.0".to_string())
            .parse()?;
        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse()?;
        let database_url = env::var("DATABASE_URL").map_err(|_| {
            anyhow!("DATABASE_URL is required, for example postgres://drink:password@db:5432/drink")
        })?;
        let database_max_connections = env::var("DATABASE_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "10".to_string())
            .parse()?;
        let jwt_secret = env::var("JWT_SECRET").map_err(|_| anyhow!("JWT_SECRET is required"))?;
        if jwt_secret.len() < 32 {
            return Err(anyhow!("JWT_SECRET must be at least 32 characters"));
        }

        Ok(Self {
            host,
            port,
            database_url,
            database_max_connections,
            jwt_secret,
        })
    }
}
