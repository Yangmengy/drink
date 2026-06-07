use adk_rust::session::sqlite::SqliteSessionService;
use adk_rust::agent::agent::Model;
use adk_rust::runner::runner::{Runner, RunnerConfig};
use adk_rust::core::content::Content;
use futures::StreamExt;

#[tokio::main]
async fn main() {
    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_else(|_| "sk-7480ef1eb9834a35868966befbd3a10d".to_string());
    
    let runner_config = RunnerConfig {
        session_service: std::sync::Arc::new(adk_rust::session::sqlite::SqliteSessionService::new("sqlite::memory:").await.unwrap()),
        model_name: "qwen-plus".to_string(),
        model_config: Some(adk_rust::model::openai::OpenAIConfig::compatible(
            api_key,
            "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
            "qwen-plus".to_string()
        )),
        agents: vec![],
        default_agent_id: None,
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
        }
    }
    println!("Final Text: {:?}", final_text);
}
