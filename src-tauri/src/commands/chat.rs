use crate::models::{Recipe, UserProfile};
use adk_rust::agent::LlmAgentBuilder;
use adk_rust::identity::{SessionId, UserId};
use adk_rust::Content;
use adk_rust::model::openai::{OpenAIClient, OpenAIConfig};
use adk_rust::runner::{Runner, RunnerConfig};
use adk_rust::futures::StreamExt;
use adk_session::{CreateRequest, DeleteRequest, GetRequest, SessionService, SqliteSessionService};
use adk_memory::{MemoryService, SqliteMemoryService, MemoryEntry, SearchRequest};
use std::collections::HashMap;
use sqlx::{Pool, Sqlite, SqlitePool, Row};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use chrono::Utc;

pub async fn init_session_service() -> Result<SqliteSessionService, String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    std::fs::create_dir_all(&path).ok();
    path.push("cocktail-chat.db");

    let db_url = format!("sqlite:{}?mode=rwc", path.display());
    println!("Initializing chat session DB at: {}", db_url);

    let service = SqliteSessionService::new(&db_url)
        .await
        .map_err(|e| format!("{}", e))?;
    service.migrate().await.map_err(|e| format!("{}", e))?;

    Ok(service)
}

pub async fn init_memory_service() -> Result<SqliteMemoryService, String> {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    std::fs::create_dir_all(&path).ok();
    path.push("cocktail-memory.db");

    let db_url = format!("sqlite:{}?mode=rwc", path.display());
    println!("Initializing memory DB at: {}", db_url);

    let service = SqliteMemoryService::new(&db_url)
        .await
        .map_err(|e| format!("{}", e))?;
    
    // 表已经手动创建，不需要 migrate
    println!("✅ Memory service initialized (tables already exist)");

    Ok(service)
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct ChatMessagePayload {
    pub id: String,
    pub role: String,
    pub text: String,
    pub recipes: Vec<Recipe>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ChatAgentResponse {
    pub reply: String,
    pub recommended_recipe_ids: Vec<String>,
}

#[tauri::command]
pub async fn send_chat_message(
    message: String,
    mood: Option<String>,
    weather: Option<String>,
    pool: State<'_, Pool<Sqlite>>,
    session_service: State<'_, Arc<SqliteSessionService>>,
    memory_service: State<'_, Arc<SqliteMemoryService>>,
) -> Result<ChatMessagePayload, String> {
    // 1. 获取用户信息与大模型配置
    let user_profile: UserProfile = sqlx::query_as(
        "SELECT id, username, avatar, bio, mbti, zodiac, llm_api_key, llm_model, llm_base_url, created_at, updated_at FROM user_profile WHERE id = 1"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("获取用户配置失败: {}", e))?;

    let api_key = user_profile.llm_api_key.ok_or("请先在设置中配置大模型 API Key")?;
    let model_name = user_profile.llm_model.unwrap_or_else(|| "qwen-max".to_string());
    let base_url = user_profile.llm_base_url.unwrap_or_else(|| "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string());

    // 2. 获取所有可用酒款作为上下文
    let available_recipes = crate::commands::get_recipes(None, pool.clone()).await.map_err(|e| e.to_string())?;
    let mut menu_str = String::from("【可用酒单】\n");
    for r in &available_recipes {
        menu_str.push_str(&format!("- ID: {}, 名称: {}, 分类: {}\n", 
            r.id, r.name_zh, r.category));
    }

    let mbti = user_profile.mbti.unwrap_or_default();
    let zodiac = user_profile.zodiac.unwrap_or_default();

    let system_prompt = format!(
        "你是一个专业的 AI 调酒师。用户的 MBTI 是 {}，星座是 {}。
请根据用户的输入，从下面的【可用酒单】中挑选最多 5 款酒推荐给用户。
请注意，你必须返回合法的 JSON 格式，包含两个字段：
1. \"reply\": 你对用户说的话（推介词，第一人称口吻，自然贴心，不需要重复说明酒的配方，因为界面会展示卡片）。
2. \"recommended_recipe_ids\": 一个字符串数组，包含你推荐的酒的 ID（如果没有推荐则为空数组）。

严格只返回 JSON，不要返回 markdown 代码块，也不要包含其他多余文本。

{}",
        mbti, zodiac, menu_str
    );

    // 3. 构建模型客户端与 Agent
    let config = OpenAIConfig::compatible(api_key, base_url, model_name);
    let client = OpenAIClient::new(config).map_err(|e| format!("{}", e))?;

    let agent = LlmAgentBuilder::new("bartender")
        .description("AI 调酒师")
        .instruction(system_prompt)
        .model(Arc::new(client))
        .build()
        .map_err(|e| format!("{}", e))?;

    // 4. 使用 adk-runner 运行对话
    let runner_config = RunnerConfig {
        app_name: "cocktail-app".to_string(),
        agent: Arc::new(agent),
        session_service: session_service.inner().clone(),
        artifact_service: None,
        memory_service: None,
        plugin_manager: None,
        run_config: None,
        compaction_config: None,
        context_cache_config: None,
        cache_capable: None,
        request_context: None,
        cancellation_token: None,
        intra_compaction_config: None,
        intra_compaction_summarizer: None,
    };
    
    let runner = Runner::new(runner_config).map_err(|e| format!("{}", e))?;
    
    let user_id = UserId::try_from("1").map_err(|e| format!("{}", e))?;
    let session_id = SessionId::try_from("default-chat").map_err(|e| format!("{}", e))?;
    
    // 确保 session 存在，如果不存在则创建（每个用户只有一个固定 session）
    let session_exists = session_service.get(GetRequest {
        app_name: "cocktail-app".to_string(),
        user_id: user_id.to_string(),
        session_id: session_id.to_string(),
        num_recent_events: None,
        after: None,
    }).await.is_ok();
    
    if !session_exists {
        println!("🔧 创建新的固定 session: default-chat");
        let mut state = HashMap::new();
        state.insert("initialized".to_string(), serde_json::json!(true));
        
        session_service.create(CreateRequest {
            app_name: "cocktail-app".to_string(),
            user_id: user_id.to_string(),
            session_id: Some(session_id.to_string()),
            state,
        }).await.map_err(|e| format!("创建 session 失败: {}", e))?;
    }
    
    let content = Content::new("user").with_text(&message);

    let mut stream = runner.run(user_id, session_id.clone(), content).await.map_err(|e| format!("{}", e))?;
    
    let mut final_text = String::new();
    let mut event_id = String::new();

    // 收集流式输出
    while let Some(result) = stream.next().await {
        match result {
            Ok(event) => {
                if let Some(c) = event.content() {
                    let text = c.parts.iter().filter_map(|p| p.text()).collect::<Vec<_>>().join("");
                    if !text.is_empty() {
                        println!("收到文本片段: {}", text);
                        final_text.push_str(&text);
                    }
                }
                event_id = event.id.clone();
            }
            Err(e) => {
                eprintln!("❌ 流式输出错误: {}", e);
                return Err(format!("AI生成失败: {}", e));
            }
        }
    }
    
    println!("=== LLM返回完整内容 ===");
    println!("{}", final_text);

    // 5. 解析 JSON 响应
    let clean_json = final_text.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();
    let ai_response: ChatAgentResponse = serde_json::from_str(clean_json).unwrap_or_else(|_| {
        ChatAgentResponse {
            reply: final_text.clone(),
            recommended_recipe_ids: vec![],
        }
    });

    // 6. 获取推荐的完整酒款信息
    let mut recipes = Vec::new();
    for r_id in &ai_response.recommended_recipe_ids {
        if let Ok(Some(recipe_detail)) = crate::commands::get_recipe_by_id(r_id.clone(), pool.clone()).await {
            recipes.push(recipe_detail.recipe);
        }
    }

    // 7. 保存对话到 memory
    let mut context_message = message.clone();
    if mood.is_some() || weather.is_some() {
        context_message = format!("【心情:{} 天气:{}】{}", 
            mood.as_deref().unwrap_or(""), 
            weather.as_deref().unwrap_or(""), 
            message);
    }
    
    let user_entry = MemoryEntry {
        content: Content::new("user").with_text(&context_message),
        author: "user".to_string(),
        timestamp: Utc::now(),
    };
    
    let assistant_entry = MemoryEntry {
        content: Content::new("assistant").with_text(&final_text),
        author: "assistant".to_string(),
        timestamp: Utc::now(),
    };
    
    memory_service.add_session(
        "cocktail-app",
        "1",
        &event_id,
        vec![user_entry, assistant_entry]
    ).await.map_err(|e| format!("保存对话记录失败: {}", e))?;
    
    println!("✅ 对话已保存到 memory");

    Ok(ChatMessagePayload {
        id: event_id,
        role: "assistant".to_string(),
        text: ai_response.reply,
        recipes,
    })
}

#[tauri::command]
pub async fn get_chat_history(
    pool: State<'_, Pool<Sqlite>>,
    memory_service: State<'_, Arc<SqliteMemoryService>>,
) -> Result<Vec<ChatMessagePayload>, String> {
    println!("=== 加载历史记录 ===");
    
    // 直接从数据库查询所有对话记录（按时间排序）
    // 不使用 FTS5 search，因为空查询不会返回结果
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    path.push("cocktail-memory.db");
    
    let db_url = format!("sqlite:{}?mode=rwc", path.display());
    let memory_pool = SqlitePool::connect(&db_url)
        .await
        .map_err(|e| format!("连接 memory 数据库失败: {}", e))?;
    
    let rows = sqlx::query(
        "SELECT content, author, timestamp FROM memory_entries 
         WHERE app_name = ? AND user_id = ? 
         ORDER BY timestamp ASC"
    )
    .bind("cocktail-app")
    .bind("1")
    .fetch_all(&memory_pool)
    .await
    .map_err(|e| format!("查询历史记录失败: {}", e))?;
    
    println!("找到 {} 条 memory entries", rows.len());
    
    let mut history = Vec::new();
    let mut current_user_msg: Option<ChatMessagePayload> = None;
    
    // 遍历所有 memory entries
    for row in rows {
        let content_str: String = row.try_get("content").map_err(|e| format!("获取 content 失败: {}", e))?;
        let author: String = row.try_get("author").map_err(|e| format!("获取 author 失败: {}", e))?;
        let timestamp_str: String = row.try_get("timestamp").map_err(|e| format!("获取 timestamp 失败: {}", e))?;
        
        // 解析 content JSON
        let content: Content = serde_json::from_str(&content_str)
            .unwrap_or_else(|_| Content::new("user"));
        
        let text = content.parts.iter()
            .filter_map(|p| p.text())
            .collect::<Vec<_>>()
            .join("\n");
        
        println!("处理 {} 消息: {} 字符", author, text.len());
        
        if author == "user" {
            // 保存用户消息，等待配对的 assistant 消息
            current_user_msg = Some(ChatMessagePayload {
                id: timestamp_str.clone(),
                role: "user".to_string(),
                text,
                recipes: vec![],
            });
        } else if author == "assistant" {
            // assistant 消息，尝试解析并获取推荐酒款
            let clean_json = text.trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();
            
            let mut reply_text = text.clone();
            let mut recipes = Vec::new();
            
            if let Ok(ai_response) = serde_json::from_str::<ChatAgentResponse>(clean_json) {
                reply_text = ai_response.reply;
                for r_id in ai_response.recommended_recipe_ids {
                    if let Ok(Some(recipe_detail)) = crate::commands::get_recipe_by_id(r_id, pool.clone()).await {
                        recipes.push(recipe_detail.recipe);
                    }
                }
            }
            
            // 先添加用户消息（如果有）
            if let Some(user_msg) = current_user_msg.take() {
                history.push(user_msg);
            }
            
            // 然后添加 assistant 消息
            history.push(ChatMessagePayload {
                id: timestamp_str,
                role: "assistant".to_string(),
                text: reply_text,
                recipes,
            });
        }
    }
    
    println!("✅ 加载了 {} 条历史消息", history.len());
    Ok(history)
}

#[tauri::command]
pub async fn clear_chat_history(
    memory_service: State<'_, Arc<SqliteMemoryService>>,
) -> Result<(), String> {
    // 删除所有用户的对话记录
    memory_service.delete_user("cocktail-app", "1")
        .await
        .map_err(|e| format!("清空历史记录失败: {}", e))?;
    Ok(())
}
