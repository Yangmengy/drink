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

    let llm = OpenAIClient::compatible(api_key, base_url, model_name.clone()).unwrap();
    
    let agent = LlmAgentBuilder::new()
        .name("cocktail_assistant")
        .llm(llm)
        .build()
        .unwrap();

    let session_service = Arc::new(SqliteSessionService::new("sqlite::memory:").await.unwrap());

    let runner_config = RunnerConfig {
        session_service,
        model_name,
        model_config: None,
        agents: vec![agent],
        default_agent_id: Some("cocktail_assistant".to_string()),
        max_turns: 5,
        global_system_instruction: None,
    };
    
    let runner = Runner::new(runner_config).unwrap();
    let content = vec![Content::new("user").with_text("测试，返回纯JSON: {\"reply\":\"你好\"}")];
    let mut stream = runner.run("user_1".to_string(), "sess_1".to_string(), content).await.unwrap();
    
    let mut final_text = String::new();
    while let Some(res) = stream.next().await {
        if let Ok(event) = res {
            if let Some(c) = event.content() {
                let text = c.parts.iter().filter_map(|p| p.text()).collect::<Vec<_>>().join("");
                println!("Delta text: {:?}", text);
                final_text.push_str(&text);
            }
        } else {
            println!("Error: {:?}", res);
        }
    }
    println!("Final Text: {:?}", final_text);
}
