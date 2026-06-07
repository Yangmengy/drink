use adk_rust::agent::LlmAgentBuilder;
use adk_rust::identity::{SessionId, UserId};
use adk_rust::Content;
use adk_rust::model::openai::{OpenAIClient, OpenAIConfig};
use adk_rust::runner::{Runner, RunnerConfig};
use adk_rust::futures::StreamExt;
use adk_session::SqliteSessionService;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let api_key = "sk-7480ef1eb9834a35868966befbd3a10d".to_string();
    let model_name = "qwen-plus".to_string();
    let base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string();

    let config = OpenAIConfig::compatible(api_key, base_url, model_name);
    let client = OpenAIClient::new(config).unwrap();

    let agent = LlmAgentBuilder::new("bartender")
        .description("AI 调酒师")
        .instruction("你是一个专业的 AI 调酒师。返回纯JSON {\"reply\":\"你好\"}")
        .model(Arc::new(client))
        .build()
        .unwrap();

    let session_service = Arc::new(SqliteSessionService::new("sqlite::memory:").await.unwrap());

    let runner_config = RunnerConfig {
        app_name: "cocktail-app".to_string(),
        agent: Arc::new(agent),
        session_service: session_service.clone(),
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
    
    let runner = Runner::new(runner_config).unwrap();
    let user_id = UserId::try_from("1").unwrap();
    let session_id = SessionId::try_from("default-chat").unwrap();

    use adk_session::{CreateRequest, SessionService};
    session_service.migrate().await.unwrap();
    session_service.create(CreateRequest {
        app_name: "cocktail-app".to_string(),
        user_id: "1".to_string(),
        session_id: "default-chat".to_string(),
    }).await.ok();

    let content = Content::new("user").with_text("测试，返回纯JSON: {\"reply\":\"你好\"}");

    let mut stream = runner.run(user_id, session_id, content).await.unwrap();
    
    let mut final_text = String::new();
    while let Some(result) = stream.next().await {
        match result {
            Ok(event) => {
                if let Some(c) = event.content() {
                    let text = c.parts.iter().filter_map(|p| p.text()).collect::<Vec<_>>().join("");
                    println!("Delta text: {:?}", text);
                    if !text.is_empty() {
                        final_text.push_str(&text);
                    }
                }
            }
            Err(e) => {
                println!("Error: {:?}", e);
            }
        }
    }
    println!("Final Text: {:?}", final_text);
}
