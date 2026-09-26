use crate::conversation;
use crate::{
    agent,
    auth::{self, login, register, CurrentUser, OwnerUser},
    context, local, memory, menu,
    models::*,
    observability, profile, settings,
    state::AppState,
};
use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use uuid::Uuid;

pub async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

pub async fn ready(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(
        serde_json::json!({ "status": "ready", "database": "ok" }),
    ))
}

pub fn api() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/me", get(auth::me))
        .route("/ingredients", get(list_ingredients).post(add_ingredient))
        .route("/ingredients/{id}/owned", patch(set_ingredient_owned))
        .route("/recipes", get(search_recipes).post(save_recipe))
        .route("/recipes/{id}", get(get_recipe).delete(delete_recipe))
        .route("/recommendations/local", post(recommend_local))
        .route(
            "/conversations",
            get(list_conversations).post(create_conversation),
        )
        .route("/conversations/{id}/chat", get(conversation_chat))
        .route("/conversations/{id}/active", post(activate_conversation))
        .route("/conversations/{id}", delete(delete_conversation))
        .route("/profile", get(get_profile).post(rebuild_profile))
        .route("/profile/events", post(create_profile_event))
        .route(
            "/memory/statements",
            get(list_memory_statements)
                .post(create_memory_statement)
                .delete(clear_auto_memory),
        )
        .route(
            "/memory/statements/{id}",
            delete(delete_memory_statement).post(revoke_memory_statement),
        )
        .route(
            "/memory/settings",
            get(get_memory_settings).put(save_memory_settings),
        )
        .route("/settings", get(get_settings).put(save_settings))
        .route("/chat", get(chat_history).delete(clear_chat))
        .route("/chat/send", post(send_chat))
        .route("/context/maintain", post(maintain_context))
        .route("/traces", get(list_traces))
        .route("/observability/summary", get(observability_summary))
}

async fn list_ingredients(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<Ingredient>>, crate::error::AppError> {
    Ok(Json(menu::inventory(&state.pool, user.id).await?))
}

async fn add_ingredient(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<NewIngredientInput>,
) -> Result<Json<AddIngredientResult>, crate::error::AppError> {
    Ok(Json(
        menu::add_ingredient(&state.pool, user.id, &input).await?,
    ))
}

async fn set_ingredient_owned(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(input): Json<OwnedInput>,
) -> Result<StatusCode, crate::error::AppError> {
    menu::set_inventory(&state.pool, user.id, &id, input.owned).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn search_recipes(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(query): Query<MenuQuery>,
) -> Result<Json<Vec<Recipe>>, crate::error::AppError> {
    Ok(Json(menu::search(&state.pool, user.id, &query).await?))
}

async fn recommend_local(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<LocalRecommendationInput>,
) -> Result<Json<LocalRecommendationResult>, crate::error::AppError> {
    Ok(Json(local::recommend(&state.pool, user.id, &input).await?))
}

async fn get_recipe(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> Result<Json<Recipe>, crate::error::AppError> {
    Ok(Json(menu::get(&state.pool, user.id, &id).await?))
}

async fn save_recipe(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<RecipeInput>,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let id = menu::save_custom(&state.pool, user.id, &input).await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

async fn delete_recipe(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> Result<StatusCode, crate::error::AppError> {
    menu::delete_custom(&state.pool, user.id, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_settings(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Settings>, crate::error::AppError> {
    Ok(Json(settings::get(&state.pool, user.id).await?))
}

async fn save_settings(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<SettingsInput>,
) -> Result<Json<Settings>, crate::error::AppError> {
    Ok(Json(settings::save(&state.pool, user.id, &input).await?))
}

async fn chat_history(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<ChatMessage>>, crate::error::AppError> {
    let conversation_id = conversation::active_id(&state.pool, user.id).await?;
    Ok(Json(
        agent::history(&state.pool, user.id, conversation_id).await?,
    ))
}

async fn clear_chat(
    State(state): State<AppState>,
    user: CurrentUser,
    body: Bytes,
) -> Result<StatusCode, crate::error::AppError> {
    let requested_id = if body.is_empty() {
        None
    } else {
        serde_json::from_slice::<ClearChatInput>(&body)
            .map_err(|_| crate::error::AppError::bad_request("请求格式不正确"))?
            .conversation_id
    };
    let conversation_id = match requested_id {
        Some(id) => conversation::get_owned(&state.pool, user.id, id).await?.id,
        None => conversation::active_id(&state.pool, user.id).await?,
    };
    agent::clear(&state.pool, user.id, conversation_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn send_chat(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<ChatSendInput>,
) -> Result<Json<ChatMessage>, crate::error::AppError> {
    let profile = settings::get(&state.pool, user.id).await?;
    let user_profile = profile::context_for_user(&state.pool, user.id).await?;
    let memories = memory::active_context(&state.pool, user.id)
        .await?
        .into_iter()
        .map(|statement| crate::models::MemoryContextItem {
            kind: statement.kind,
            content: statement.content,
            confidence: statement.confidence,
            expires_at: statement.expires_at,
        })
        .collect();
    let conversation_id = match input.conversation_id {
        Some(id) => conversation::get_owned(&state.pool, user.id, id).await?.id,
        None => conversation::active_id(&state.pool, user.id).await?,
    };
    let context = AgentContext {
        profile: user_profile,
        summary: context::active_summary_text(&state.pool, user.id).await?,
        memories,
    };
    agent::send(
        &state.pool,
        user.id,
        conversation_id,
        &profile,
        &context,
        &input,
    )
    .await
    .map(Json)
}

async fn maintain_context(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<ContextMaintainInput>,
) -> Result<Json<ContextMaintainResponse>, crate::error::AppError> {
    let conversation_id = match input.conversation_id {
        Some(id) => conversation::get_owned(&state.pool, user.id, id).await?.id,
        None => conversation::active_id(&state.pool, user.id).await?,
    };
    let profile = settings::get(&state.pool, user.id).await?;
    Ok(Json(
        context::maintain(&state.pool, user.id, conversation_id, &profile, &input).await?,
    ))
}

async fn list_traces(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(query): Query<TraceListQuery>,
) -> Result<Json<Vec<AgentTrace>>, crate::error::AppError> {
    Ok(Json(
        agent::traces(&state.pool, user.id, query.conversation_id).await?,
    ))
}

async fn list_conversations(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<conversation::ConversationSummary>>, crate::error::AppError> {
    Ok(Json(conversation::list(&state.pool, user.id).await?))
}

async fn create_conversation(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<CreateConversationInput>,
) -> Result<Json<conversation::Conversation>, crate::error::AppError> {
    Ok(Json(
        conversation::create(&state.pool, user.id, &input).await?,
    ))
}

async fn conversation_chat(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ChatMessage>>, crate::error::AppError> {
    conversation::get_owned(&state.pool, user.id, id).await?;
    Ok(Json(agent::history(&state.pool, user.id, id).await?))
}

async fn activate_conversation(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, crate::error::AppError> {
    conversation::set_active(&state.pool, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_conversation(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Uuid>, crate::error::AppError> {
    Ok(Json(conversation::delete(&state.pool, user.id, id).await?))
}

async fn get_profile(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<profile::UserProfile>, crate::error::AppError> {
    Ok(Json(profile::get(&state.pool, user.id).await?))
}

async fn create_profile_event(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<profile::ProfileEventInput>,
) -> Result<Json<profile::ProfileEvent>, crate::error::AppError> {
    Ok(Json(
        profile::record_event(&state.pool, user.id, &input).await?,
    ))
}

async fn rebuild_profile(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<profile::UserProfile>, crate::error::AppError> {
    Ok(Json(profile::rebuild(&state.pool, user.id).await?))
}

async fn list_memory_statements(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(include): Query<MemoryListQuery>,
) -> Result<Json<Vec<memory::MemoryStatement>>, crate::error::AppError> {
    Ok(Json(
        memory::list(&state.pool, user.id, include.include_inactive).await?,
    ))
}

async fn create_memory_statement(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<memory::MemoryStatementInput>,
) -> Result<Json<memory::MemoryStatement>, crate::error::AppError> {
    Ok(Json(memory::create(&state.pool, user.id, &input).await?))
}

async fn delete_memory_statement(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, crate::error::AppError> {
    memory::delete(&state.pool, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn revoke_memory_statement(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, crate::error::AppError> {
    memory::revoke(&state.pool, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn clear_auto_memory(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let deleted = memory::clear_low_risk(&state.pool, user.id).await?;
    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

async fn get_memory_settings(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<memory::MemorySettings>, crate::error::AppError> {
    Ok(Json(memory::settings(&state.pool, user.id).await?))
}

async fn save_memory_settings(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<memory::MemorySettingsInput>,
) -> Result<Json<memory::MemorySettings>, crate::error::AppError> {
    Ok(Json(
        memory::save_settings(&state.pool, user.id, &input).await?,
    ))
}

async fn observability_summary(
    State(state): State<AppState>,
    _owner: OwnerUser,
) -> Result<Json<observability::ObservabilitySnapshot>, crate::error::AppError> {
    Ok(Json(observability::summary(&state.pool).await?))
}
