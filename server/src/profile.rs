use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgConnection, PgPool, Row};
use uuid::Uuid;

use crate::{error::AppError, models::Flavor};

const EVENT_TYPES: &[&str] = &[
    "quiz_answer",
    "constraint_set",
    "view",
    "favorite",
    "make",
    "like",
    "dislike",
    "feedback",
    "skip",
];

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileConstraints {
    #[serde(default)]
    pub no_alcohol: bool,
    #[serde(default)]
    pub allergies: Vec<String>,
    #[serde(default)]
    pub avoid_ingredients: Vec<String>,
    #[serde(default)]
    pub max_abv_level: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlavorPreference {
    #[serde(default = "default_medium")]
    pub sweet: f64,
    #[serde(default = "default_sour")]
    pub sour: f64,
    #[serde(default = "default_bitter")]
    pub bitter: f64,
    #[serde(default = "default_medium")]
    pub strong: f64,
}

fn default_medium() -> f64 {
    2.5
}

fn default_sour() -> f64 {
    3.0
}

fn default_bitter() -> f64 {
    2.0
}

impl Default for FlavorPreference {
    fn default() -> Self {
        Self {
            sweet: default_medium(),
            sour: default_sour(),
            bitter: default_bitter(),
            strong: default_medium(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePreferences {
    #[serde(default)]
    pub flavor: FlavorPreference,
    #[serde(default)]
    pub base_spirit: HashMap<String, f64>,
    #[serde(default)]
    pub tag_affinity: HashMap<String, f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileConfidence {
    #[serde(default)]
    pub flavor: FlavorConfidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlavorConfidence {
    #[serde(default)]
    pub sweet: f64,
    #[serde(default)]
    pub sour: f64,
    #[serde(default)]
    pub bitter: f64,
    #[serde(default)]
    pub strong: f64,
}

impl Default for FlavorConfidence {
    fn default() -> Self {
        Self::default_values()
    }
}

impl FlavorConfidence {
    fn default_values() -> Self {
        Self {
            sweet: 0.0,
            sour: 0.0,
            bitter: 0.0,
            strong: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub schema_version: i32,
    pub constraints: Value,
    pub preferences: Value,
    pub confidence: Value,
    pub profile_revision: i64,
    pub last_event_seq: Option<i64>,
    pub computed_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileEventInput {
    #[serde(alias = "type")]
    pub event_type: String,
    #[serde(default = "default_source")]
    pub source: String,
    pub recipe_id: Option<String>,
    #[serde(default)]
    pub payload: Value,
    pub idempotency_key: Option<String>,
    pub trace_id: Option<String>,
}

fn default_source() -> String {
    "structured_ui".to_owned()
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProfileEvent {
    pub id: Uuid,
    pub seq: i64,
    pub event_type: String,
    pub source: String,
    pub recipe_id: Option<String>,
    pub payload: Value,
    pub idempotency_key: String,
    pub trace_id: Option<String>,
    pub occurred_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

#[derive(Debug)]
struct ProjectionEvent {
    seq: i64,
    event_type: String,
    recipe_id: Option<String>,
    payload: Value,
    occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default)]
pub struct Projection {
    pub constraints: ProfileConstraints,
    pub preferences: ProfilePreferences,
    pub confidence: ProfileConfidence,
}

pub fn validate_event_input(input: &ProfileEventInput) -> Result<(), AppError> {
    if !EVENT_TYPES.contains(&input.event_type.as_str()) {
        return Err(AppError::bad_request("画像事件类型无效"));
    }
    if !matches!(
        input.source.as_str(),
        "structured_ui" | "chat_confirmed" | "system"
    ) {
        return Err(AppError::bad_request("画像事件来源无效"));
    }
    if input.recipe_id.is_none()
        && !matches!(input.event_type.as_str(), "quiz_answer" | "constraint_set")
    {
        return Err(AppError::bad_request("该画像事件必须指定酒品"));
    }
    if serde_json::to_value(&input.payload).is_err() {
        return Err(AppError::bad_request("画像事件参数无效"));
    }
    Ok(())
}

pub async fn record_event(
    pool: &PgPool,
    user_id: Uuid,
    input: &ProfileEventInput,
) -> Result<ProfileEvent, AppError> {
    let mut transaction = pool.begin().await?;
    let event = record_event_on(&mut transaction, user_id, input).await?;
    transaction.commit().await?;
    Ok(event)
}

pub async fn record_event_on(
    connection: &mut PgConnection,
    user_id: Uuid,
    input: &ProfileEventInput,
) -> Result<ProfileEvent, AppError> {
    validate_event_input(input)?;
    let idempotency_key = input
        .idempotency_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| format!("api:{}", Uuid::new_v4()));
    if idempotency_key.chars().count() > 200 {
        return Err(AppError::bad_request("幂等键最多 200 字"));
    }

    let inserted = sqlx::query_as::<_, ProfileEvent>(
        r#"
        INSERT INTO user_profile_events
            (user_id, event_type, source, recipe_id, payload, idempotency_key, trace_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        RETURNING id, seq, event_type, source, recipe_id, payload,
                  idempotency_key, trace_id, occurred_at, processed_at
        "#,
    )
    .bind(user_id)
    .bind(&input.event_type)
    .bind(&input.source)
    .bind(&input.recipe_id)
    .bind(&input.payload)
    .bind(&idempotency_key)
    .bind(&input.trace_id)
    .fetch_optional(&mut *connection)
    .await?;
    let event = if let Some(event) = inserted {
        project_and_save(connection, user_id).await?;
        event
    } else {
        sqlx::query_as::<_, ProfileEvent>(
            r#"
            SELECT id, seq, event_type, source, recipe_id, payload,
                   idempotency_key, trace_id, occurred_at, processed_at
            FROM user_profile_events
            WHERE user_id = $1 AND idempotency_key = $2
            "#,
        )
        .bind(user_id)
        .bind(&idempotency_key)
        .fetch_one(&mut *connection)
        .await?
    };
    Ok(event)
}

pub async fn get(pool: &PgPool, user_id: Uuid) -> Result<UserProfile, AppError> {
    sqlx::query_as::<_, UserProfile>(
        r#"
        SELECT schema_version, constraints, preferences, confidence,
               profile_revision, last_event_seq, computed_at, updated_at
        FROM user_profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("画像尚未生成"))
}

pub async fn constraints(pool: &PgPool, user_id: Uuid) -> Result<ProfileConstraints, AppError> {
    let profile = match get(pool, user_id).await? {
        profile if profile.last_event_seq.is_some() => profile,
        _ => return Ok(ProfileConstraints::default()),
    };
    serde_json::from_value(profile.constraints).map_err(|_| AppError::internal())
}

pub async fn projection(pool: &PgPool, user_id: Uuid) -> Result<Projection, AppError> {
    let Some(existing) = sqlx::query_as::<_, UserProfile>(
        r#"
        SELECT schema_version, constraints, preferences, confidence,
               profile_revision, last_event_seq, computed_at, updated_at
        FROM user_profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(Projection::default());
    };
    Ok(Projection {
        constraints: serde_json::from_value(existing.constraints)
            .map_err(|_| AppError::internal())?,
        preferences: serde_json::from_value(existing.preferences)
            .map_err(|_| AppError::internal())?,
        confidence: serde_json::from_value(existing.confidence)
            .map_err(|_| AppError::internal())?,
    })
}

pub async fn rebuild_on(
    connection: &mut PgConnection,
    user_id: Uuid,
) -> Result<UserProfile, AppError> {
    project_and_save(connection, user_id).await
}

pub async fn rebuild(pool: &PgPool, user_id: Uuid) -> Result<UserProfile, AppError> {
    let mut transaction = pool.begin().await?;
    let profile = project_and_save(&mut transaction, user_id).await?;
    transaction.commit().await?;
    Ok(profile)
}

async fn project_and_save(
    connection: &mut PgConnection,
    user_id: Uuid,
) -> Result<UserProfile, AppError> {
    let event_rows = sqlx::query_as::<_, ProjectionEventRow>(
        r#"
        SELECT seq, event_type, recipe_id, payload, occurred_at
        FROM user_profile_events
        WHERE user_id = $1
        ORDER BY seq
        "#,
    )
    .bind(user_id)
    .fetch_all(&mut *connection)
    .await?;

    let recipe_flavors: HashMap<String, Flavor> = sqlx::query(
        r#"
        SELECT id, flavor_profile
        FROM recipes
        WHERE user_id = $1 OR user_id IS NULL
        "#,
    )
    .bind(user_id)
    .fetch_all(&mut *connection)
    .await?
    .into_iter()
    .filter_map(|row| {
        let id: String = row.get("id");
        let flavor: Option<Flavor> = row
            .get::<Option<Value>, _>("flavor_profile")
            .and_then(|value| serde_json::from_value(value).ok());
        flavor.map(|flavor| (id, flavor))
    })
    .collect();

    let events = event_rows
        .iter()
        .map(|row| ProjectionEvent {
            seq: row.seq,
            event_type: row.event_type.clone(),
            recipe_id: row.recipe_id.clone(),
            payload: row.payload.clone(),
            occurred_at: row.occurred_at,
        })
        .collect::<Vec<_>>();
    let projection = project(&events, &recipe_flavors);
    let last_event_seq = events.last().map(|event| event.seq);

    let profile = sqlx::query_as::<_, UserProfile>(
        r#"
        INSERT INTO user_profiles
            (user_id, constraints, preferences, confidence,
             profile_revision, last_event_seq, computed_at, updated_at)
        VALUES ($1, $2, $3, $4, 1, $5, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            constraints = EXCLUDED.constraints,
            preferences = EXCLUDED.preferences,
            confidence = EXCLUDED.confidence,
            profile_revision = user_profiles.profile_revision + 1,
            last_event_seq = EXCLUDED.last_event_seq,
            computed_at = NOW(),
            updated_at = NOW()
        RETURNING schema_version, constraints, preferences, confidence,
                  profile_revision, last_event_seq, computed_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(serde_json::to_value(&projection.constraints).map_err(|_| AppError::internal())?)
    .bind(serde_json::to_value(&projection.preferences).map_err(|_| AppError::internal())?)
    .bind(serde_json::to_value(&projection.confidence).map_err(|_| AppError::internal())?)
    .bind(last_event_seq)
    .fetch_one(&mut *connection)
    .await?;

    sqlx::query("UPDATE user_profile_events SET processed_at = NOW() WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *connection)
        .await?;
    Ok(profile)
}

#[derive(sqlx::FromRow)]
struct ProjectionEventRow {
    seq: i64,
    event_type: String,
    recipe_id: Option<String>,
    payload: Value,
    occurred_at: DateTime<Utc>,
}

fn project(events: &[ProjectionEvent], recipes: &HashMap<String, Flavor>) -> Projection {
    let mut projection = Projection::default();
    for event in events {
        match event.event_type.as_str() {
            "quiz_answer" => apply_profile_patch(&mut projection, &event.payload, 0.3),
            "constraint_set" => apply_profile_patch(&mut projection, &event.payload, 1.0),
            "view" | "favorite" | "make" | "like" | "dislike" | "skip" | "feedback" => {
                apply_recipe_event(&mut projection, event, recipes);
            }
            _ => {}
        }
    }
    projection
}

fn apply_profile_patch(projection: &mut Projection, payload: &Value, confidence: f64) {
    if let Some(value) = payload.get("constraints") {
        if let Ok(constraints) = serde_json::from_value::<ProfileConstraints>(value.clone()) {
            projection.constraints = constraints;
        }
    }
    if let Some(value) = payload.get("preferences") {
        if let Ok(preferences) = serde_json::from_value::<ProfilePreferences>(value.clone()) {
            projection.preferences.flavor = preferences.flavor;
            projection.preferences.base_spirit = preferences.base_spirit;
            projection.preferences.tag_affinity = preferences.tag_affinity;
        }
    }
    if let Some(value) = payload.get("confidence") {
        if let Ok(confidence) = serde_json::from_value::<ProfileConfidence>(value.clone()) {
            projection.confidence = confidence;
        }
    } else {
        projection.confidence.flavor = FlavorConfidence {
            sweet: confidence,
            sour: confidence,
            bitter: confidence,
            strong: confidence,
        };
    }
}

fn apply_recipe_event(
    projection: &mut Projection,
    event: &ProjectionEvent,
    recipes: &HashMap<String, Flavor>,
) {
    let Some(recipe_id) = &event.recipe_id else {
        return;
    };
    let Some(flavor) = recipes.get(recipe_id) else {
        return;
    };
    let mut direction = match event.event_type.as_str() {
        "make" | "favorite" | "like" | "view" => 1.0,
        "dislike" | "skip" => -1.0,
        "feedback" => 0.0,
        _ => return,
    };
    let alpha = match event.event_type.as_str() {
        "make" => 1.0,
        "favorite" => 0.8,
        "like" => 0.6,
        "view" => 0.1,
        "dislike" => 0.8,
        "skip" => 0.05,
        "feedback" => 0.8,
        _ => return,
    } * time_decay(event.occurred_at);

    if event.event_type == "feedback" {
        let dimension = payload_text(&event.payload, "dimension");
        let direction_text = payload_text(&event.payload, "direction");
        if direction_text == "lower" {
            direction = -1.0;
        } else if direction_text == "higher" {
            direction = 1.0;
        } else {
            return;
        }
        match dimension.as_str() {
            "sweet" => {
                projection.preferences.flavor.sweet =
                    clamp05(projection.preferences.flavor.sweet + direction * 0.4);
                projection.confidence.flavor.sour =
                    raise(projection.confidence.flavor.sour, alpha * 0.5);
            }
            "sour" => {
                projection.preferences.flavor.sour =
                    clamp05(projection.preferences.flavor.sour + direction * 0.4);
                projection.confidence.flavor.sour =
                    raise(projection.confidence.flavor.sour, alpha * 0.5);
            }
            "bitter" => {
                projection.preferences.flavor.bitter =
                    clamp05(projection.preferences.flavor.bitter + direction * 0.4);
                projection.confidence.flavor.bitter =
                    raise(projection.confidence.flavor.bitter, alpha * 0.5);
            }
            "strong" => {
                projection.preferences.flavor.strong =
                    clamp05(projection.preferences.flavor.strong + direction * 0.4);
                projection.confidence.flavor.strong =
                    raise(projection.confidence.flavor.strong, alpha * 0.5);
            }
            _ => {}
        }
        return;
    }

    let target = FlavorPreference {
        sweet: flavor.sweet as f64,
        sour: flavor.sour as f64,
        bitter: flavor.bitter as f64,
        strong: flavor.strong as f64,
    };
    for (preference, confidence, target_value) in [
        (
            &mut projection.preferences.flavor.sweet,
            &mut projection.confidence.flavor.sweet,
            target.sweet,
        ),
        (
            &mut projection.preferences.flavor.sour,
            &mut projection.confidence.flavor.sour,
            target.sour,
        ),
        (
            &mut projection.preferences.flavor.bitter,
            &mut projection.confidence.flavor.bitter,
            target.bitter,
        ),
        (
            &mut projection.preferences.flavor.strong,
            &mut projection.confidence.flavor.strong,
            target.strong,
        ),
    ] {
        *preference = clamp05(*preference + direction * alpha * (target_value - *preference) * 0.2);
        *confidence = raise(*confidence, alpha * 0.1);
    }
    let _ = alpha;
}

fn payload_text(payload: &Value, key: &str) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn time_decay(occurred_at: DateTime<Utc>) -> f64 {
    let age_days = (Utc::now() - occurred_at).num_days().max(0) as f64;
    0.5f64.powf(age_days / 90.0)
}

fn clamp05(value: f64) -> f64 {
    value.clamp(0.0, 5.0)
}

fn raise(current: f64, amount: f64) -> f64 {
    (current + amount).clamp(0.0, 1.0)
}

pub fn profile_context(profile: &UserProfile) -> Result<Value, AppError> {
    let constraints: ProfileConstraints =
        serde_json::from_value(profile.constraints.clone()).map_err(|_| AppError::internal())?;
    let preferences: ProfilePreferences =
        serde_json::from_value(profile.preferences.clone()).map_err(|_| AppError::internal())?;
    let confidence: ProfileConfidence =
        serde_json::from_value(profile.confidence.clone()).map_err(|_| AppError::internal())?;
    Ok(json!({
        "constraints": constraints,
        "preferences": preferences,
        "confidence": confidence,
        "revision": profile.profile_revision,
    }))
}

pub async fn context_for_user(pool: &PgPool, user_id: Uuid) -> Result<Value, AppError> {
    match get(pool, user_id).await {
        Ok(profile) => profile_context(&profile),
        Err(error) if error.is_not_found() => {
            let projection = Projection::default();
            Ok(json!({
                "constraints": projection.constraints,
                "preferences": projection.preferences,
                "confidence": projection.confidence,
                "revision": 0,
            }))
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(event_type: &str, payload: Value) -> ProjectionEvent {
        ProjectionEvent {
            seq: 1,
            event_type: event_type.to_owned(),
            recipe_id: None,
            payload,
            occurred_at: Utc::now(),
        }
    }

    #[test]
    fn projection_accepts_structured_patches() {
        let projection = project(
            &[event(
                "quiz_answer",
                json!({
                    "constraints": {"noAlcohol": true, "allergies": ["dairy"]},
                    "preferences": {"flavor": {"sweet": 1.0, "sour": 4.0, "bitter": 1.0, "strong": 1.0}}
                }),
            )],
            &HashMap::new(),
        );
        assert!(projection.constraints.no_alcohol);
        assert_eq!(projection.constraints.allergies, vec!["dairy"]);
        assert_eq!(projection.preferences.flavor.sour, 4.0);
    }

    #[test]
    fn projection_rejects_missing_recipe_safely() {
        let event = ProjectionEvent {
            seq: 1,
            event_type: "like".to_owned(),
            recipe_id: Some("missing".to_owned()),
            payload: json!({}),
            occurred_at: Utc::now(),
        };
        let projection = project(&[event], &HashMap::new());
        assert_eq!(projection.preferences.flavor.sour, 3.0);
    }
}
