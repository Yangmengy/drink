use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{FromRequestParts, State},
    http::request::Parts,
    Json,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

#[derive(Debug, Deserialize)]
pub struct RegisterInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    #[serde(rename = "tokenType")]
    pub token_type: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub user: AuthUser,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: Uuid,
    exp: i64,
    iat: i64,
}

#[derive(Debug)]
pub struct CurrentUser {
    pub id: Uuid,
}

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(AppError::unauthorized)?;
        let token = header
            .strip_prefix("Bearer ")
            .ok_or_else(AppError::unauthorized)?;
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
            &Validation::default(),
        )?;
        Ok(Self {
            id: data.claims.sub,
        })
    }
}

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<RegisterInput>,
) -> Result<(axum::http::StatusCode, Json<AuthResponse>), AppError> {
    let email = normalize_email(&input.email)?;
    validate_password(&input.password)?;

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(input.password.as_bytes(), &salt)
        .map_err(|_| AppError::internal())?
        .to_string();

    let user = insert_user(&state.pool, &email, &password_hash).await?;
    let response = issue_token(&state.jwt_secret, user)?;
    Ok((axum::http::StatusCode::CREATED, Json(response)))
}

pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginInput>,
) -> Result<Json<AuthResponse>, AppError> {
    let email = normalize_email(&input.email)?;
    let row = sqlx::query(
        r#"
        SELECT id, email, password_hash, created_at
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await?;

    let row = row.ok_or_else(|| {
        AppError::new(
            axum::http::StatusCode::UNAUTHORIZED,
            "invalid email or password",
        )
    })?;
    let id: Uuid = row.try_get("id").map_err(|_| AppError::internal())?;
    let stored_email: String = row.try_get("email").map_err(|_| AppError::internal())?;
    let created_at: chrono::DateTime<chrono::Utc> = row
        .try_get("created_at")
        .map_err(|_| AppError::internal())?;
    let password_hash: String = row
        .try_get("password_hash")
        .map_err(|_| AppError::internal())?;
    let parsed_hash = PasswordHash::new(&password_hash).map_err(|_| AppError::internal())?;
    Argon2::default()
        .verify_password(input.password.as_bytes(), &parsed_hash)
        .map_err(|_| {
            AppError::new(
                axum::http::StatusCode::UNAUTHORIZED,
                "invalid email or password",
            )
        })?;

    let user = AuthUser {
        id,
        email: stored_email,
        created_at,
    };
    Ok(Json(issue_token(&state.jwt_secret, user)?))
}

pub async fn me(
    State(state): State<AppState>,
    current: CurrentUser,
) -> Result<Json<AuthUser>, AppError> {
    let user = sqlx::query_as::<_, AuthUserRow>(
        r#"
        SELECT id, email, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(current.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(AppError::unauthorized)?;

    Ok(Json(AuthUser {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
    }))
}

#[derive(sqlx::FromRow)]
struct AuthUserRow {
    id: Uuid,
    email: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

async fn insert_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
) -> Result<AuthUser, AppError> {
    let row = sqlx::query(
        r#"
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, created_at
        "#,
    )
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await?;

    Ok(AuthUser {
        id: row.try_get("id").map_err(|_| AppError::internal())?,
        email: row.try_get("email").map_err(|_| AppError::internal())?,
        created_at: row
            .try_get("created_at")
            .map_err(|_| AppError::internal())?,
    })
}

fn issue_token(secret: &str, user: AuthUser) -> Result<AuthResponse, AppError> {
    let now = Utc::now();
    let expires_at = now + Duration::days(7);
    let claims = Claims {
        sub: user.id,
        iat: now.timestamp(),
        exp: expires_at.timestamp(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AppError::internal())?;
    Ok(AuthResponse {
        token,
        token_type: "Bearer".to_string(),
        expires_at,
        user,
    })
}

fn normalize_email(value: &str) -> Result<String, AppError> {
    let email = value.trim().to_lowercase();
    let valid = !email.is_empty()
        && email.len() <= 255
        && email.contains('@')
        && !email.starts_with('@')
        && !email.ends_with('@')
        && !email.contains(char::is_whitespace);
    if !valid {
        return Err(AppError::bad_request("email is invalid"));
    }
    Ok(email)
}

fn validate_password(value: &str) -> Result<(), AppError> {
    if value.len() < 8 || value.len() > 128 {
        return Err(AppError::bad_request(
            "password must be between 8 and 128 characters",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn email_is_trimmed_and_lowercased() {
        assert_eq!(
            normalize_email("  USER@Example.COM ").unwrap(),
            "user@example.com"
        );
    }

    #[test]
    fn malformed_emails_are_rejected() {
        for value in ["", "user", "@example.com", "user @example.com"] {
            assert!(normalize_email(value).is_err(), "failed to reject {value}");
        }
    }

    #[test]
    fn password_length_is_enforced() {
        assert!(validate_password("1234567").is_err());
        assert!(validate_password("12345678").is_ok());
    }
}
