use adk_rust::{
    async_trait,
    model::openai::{OpenAIClient, OpenAIConfig},
    Content, Llm, LlmRequest, LlmResponse, LlmResponseStream, Part,
};
use adk_session::{GetRequest, InMemorySessionService, SessionService, SqliteSessionService};
use cocktail_app_lib::{
    agent::Companion,
    db,
    models::*,
    streaming::{ChatStreamEvent, StreamSink},
    trace,
};
use serde_json::json;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::{mpsc, oneshot},
};

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    db::initialize(&pool).await.unwrap();
    pool
}

fn profile() -> Settings {
    Settings {
        name: "测试用户".into(),
        preferences: String::new(),
        model: "mock".into(),
        base_url: "http://localhost/v1".into(),
        api_key_configured: true,
        data_directory: String::new(),
    }
}

fn events() -> (StreamSink, mpsc::UnboundedReceiver<ChatStreamEvent>) {
    let (sender, receiver) = mpsc::unbounded_channel();
    (
        StreamSink::new(move |event| {
            let _ = sender.send(event);
        }),
        receiver,
    )
}

async fn next_text(receiver: &mut mpsc::UnboundedReceiver<ChatStreamEvent>) -> String {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let ChatStreamEvent::Text { text, .. } = receiver.recv().await.unwrap() {
                return text;
            }
        }
    })
    .await
    .unwrap()
}

#[tokio::test]
async fn actual_adk_sse_publishes_partial_text_and_trace_before_http_completion() {
    let pool = database().await;
    let sessions = Arc::new(InMemorySessionService::new());
    let companion = Arc::new(
        Companion::new(pool.clone(), sessions.clone())
            .await
            .unwrap(),
    );
    let (sink, mut received) = events();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (release, wait_release) = oneshot::channel::<()>();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = Vec::new();
        let mut buffer = [0u8; 4096];
        let (header_end, length) = loop {
            let count = socket.read(&mut buffer).await.unwrap();
            assert!(count > 0);
            bytes.extend_from_slice(&buffer[..count]);
            if let Some(end) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&bytes[..end]);
                let length = headers
                    .lines()
                    .find_map(|line| {
                        line.to_lowercase()
                            .strip_prefix("content-length:")
                            .map(|value| value.trim().parse::<usize>().unwrap())
                    })
                    .unwrap();
                break (end + 4, length);
            }
        };
        while bytes.len() < header_end + length {
            let count = socket.read(&mut buffer).await.unwrap();
            assert!(count > 0);
            bytes.extend_from_slice(&buffer[..count]);
        }
        let request: serde_json::Value =
            serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap();
        assert_eq!(request["stream"], true);
        let frame = |delta: serde_json::Value, finish: serde_json::Value| {
            let chunk = json!({"id":"stream-test","object":"chat.completion.chunk",
            "created":1789600000,"model":"mock","choices":[
                {"index":0,"delta":delta,"finish_reason":finish}
            ]});
            format!("data: {chunk}\n\n")
        };
        let prefix = frame(
            json!({"reasoning_content":"内部思考绝不能显示"}),
            json!(null),
        ) + &frame(
            json!({"content":"{\"recipeIds\":[],\"reply\":\"我在，"}),
            json!(null),
        );
        let suffix = frame(json!({"content":"慢慢聊。\"}"}), json!(null))
            + &frame(json!({}), json!("stop"))
            + "data: [DONE]\n\n";
        let headers = format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", prefix.len()+suffix.len());
        socket.write_all(headers.as_bytes()).await.unwrap();
        socket.write_all(prefix.as_bytes()).await.unwrap();
        socket.flush().await.unwrap();
        wait_release.await.unwrap();
        socket.write_all(suffix.as_bytes()).await.unwrap();
        socket.flush().await.unwrap();
    });
    let model = OpenAIClient::new(OpenAIConfig::compatible(
        "stream-test-private-key",
        format!("http://{address}/v1"),
        "mock",
    ))
    .unwrap();
    let running = {
        let companion = companion.clone();
        tokio::spawn(async move {
            companion
                .reply_streaming(Arc::new(model), &profile(), "陪我聊聊", sink)
                .await
        })
    };
    let first = tokio::time::timeout(Duration::from_secs(5), received.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(
        matches!(first, ChatStreamEvent::Trace { ref event, .. } if event.phase == "turn.start")
    );
    assert_eq!(next_text(&mut received).await, "我在，");
    assert!(
        !running.is_finished(),
        "the server has not sent its final frame"
    );
    let staged = sessions
        .get(GetRequest {
            app_name: "cocktail-app".into(),
            user_id: "1".into(),
            session_id: "default-chat".into(),
            num_recent_events: None,
            after: None,
        })
        .await
        .unwrap();
    assert_eq!(
        staged.events().all().len(),
        0,
        "partials must not enter durable context"
    );
    release.send(()).unwrap();
    let reply = tokio::time::timeout(Duration::from_secs(5), running)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    server.await.unwrap();
    assert_eq!(reply.text, "我在，慢慢聊。");
    assert_eq!(companion.history().await.unwrap().len(), 2);
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces[0].status, "ok");
    let mut rest = Vec::new();
    while let Ok(event) = received.try_recv() {
        rest.push(event);
    }
    assert!(rest.iter().any(|event| matches!(event, ChatStreamEvent::Trace { event, .. } if event.phase == "turn.complete")));
    let serialized = serde_json::to_string(&rest).unwrap();
    assert!(!serialized.contains("内部思考"));
    assert!(!serialized.contains("recipeIds"));
    assert!(!serialized.contains("stream-test-private-key"));
}

struct FailingStream;
#[async_trait]
impl Llm for FailingStream {
    fn name(&self) -> &str {
        "failing-stream"
    }
    async fn generate_content(
        &self,
        _: LlmRequest,
        stream: bool,
    ) -> adk_rust::Result<LlmResponseStream> {
        assert!(stream);
        Ok(Box::pin(adk_rust::futures::stream::iter(vec![
            Ok(LlmResponse {
                content: Some(Content::new("model").with_text("{\"reply\":\"还没完成")),
                partial: true,
                turn_complete: false,
                ..Default::default()
            }),
            Err(adk_rust::AdkError::model("test stream interrupted")),
        ])))
    }
}

#[tokio::test]
async fn interrupted_stream_publishes_failure_trace_without_polluting_history() {
    let pool = database().await;
    let directory = tempfile::tempdir().unwrap();
    let session_url = format!(
        "sqlite:{}?mode=rwc",
        directory.path().join("chat.db").display()
    );
    let sessions = SqliteSessionService::new(&session_url).await.unwrap();
    sessions.migrate().await.unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(sessions))
        .await
        .unwrap();
    let (sink, mut received) = events();
    let result = companion
        .reply_streaming(Arc::new(FailingStream), &profile(), "本轮失败", sink)
        .await;
    assert!(result.is_err());
    assert_eq!(next_text(&mut received).await, "还没完成");
    assert!(companion.history().await.unwrap().is_empty());
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces[0].status, "error");
    let mut rest = Vec::new();
    while let Ok(event) = received.try_recv() {
        rest.push(event);
    }
    assert!(rest.iter().any(
        |event| matches!(event, ChatStreamEvent::Trace { event, .. } if event.phase == "turn.error")
    ));
    drop(companion);
    let reopened = Companion::new(
        pool,
        Arc::new(SqliteSessionService::new(&session_url).await.unwrap()),
    )
    .await
    .unwrap();
    assert!(reopened.history().await.unwrap().is_empty());
}

struct ToolRoundModel(Mutex<usize>);
#[async_trait]
impl Llm for ToolRoundModel {
    fn name(&self) -> &str {
        "tool-rounds"
    }
    async fn generate_content(
        &self,
        _: LlmRequest,
        _: bool,
    ) -> adk_rust::Result<LlmResponseStream> {
        let mut round = self.0.lock().unwrap();
        *round += 1;
        let chunks = if *round == 1 {
            vec![
                LlmResponse {
                    content: Some(Content::new("model").with_text("{\"reply\":\"先查询")),
                    partial: true,
                    turn_complete: false,
                    ..Default::default()
                },
                LlmResponse {
                    content: Some(Content {
                        role: "model".into(),
                        parts: vec![Part::FunctionCall {
                            name: "search_menu".into(),
                            args: json!({"query":"无匹配的测试条件"}),
                            id: Some("tool-round".into()),
                            thought_signature: None,
                        }],
                    }),
                    partial: false,
                    turn_complete: true,
                    ..Default::default()
                },
            ]
        } else {
            vec![
                LlmResponse {
                    content: Some(Content::new("model").with_text("{\"reply\":\"没有找到")),
                    partial: true,
                    turn_complete: false,
                    ..Default::default()
                },
                LlmResponse {
                    content: Some(
                        Content::new("model").with_text("，我们再看看。\",\"recipeIds\":[]}"),
                    ),
                    partial: false,
                    turn_complete: true,
                    ..Default::default()
                },
            ]
        };
        Ok(Box::pin(adk_rust::futures::stream::iter(
            chunks.into_iter().map(Ok),
        )))
    }
}

#[tokio::test]
async fn tool_iterations_replace_provisional_text_and_save_only_the_validated_final_reply() {
    let pool = database().await;
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    let (sink, mut received) = events();
    let result = companion
        .reply_streaming(
            Arc::new(ToolRoundModel(Mutex::new(0))),
            &profile(),
            "查询测试条件",
            sink,
        )
        .await
        .unwrap();
    assert_eq!(result.text, "没有找到，我们再看看。");
    let mut texts = Vec::new();
    while let Ok(event) = received.try_recv() {
        if let ChatStreamEvent::Text { text, .. } = event {
            texts.push(text);
        }
    }
    assert_eq!(
        &texts[..4],
        &["先查询", "", "没有找到", "没有找到，我们再看看。"]
    );
    assert_eq!(companion.history().await.unwrap()[1].text, result.text);
}

#[tokio::test]
async fn local_recommendation_streams_real_trace_and_one_complete_deterministic_reply() {
    let pool = database().await;
    let directory = tempfile::tempdir().unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    let (sink, mut received) = events();
    let result = companion
        .recommend_local_streaming(
            directory.path(),
            &LocalRecommendationInput {
                availability: LocalAvailability::Any,
                query: MenuQuery::default(),
                after_trace_id: None,
            },
            sink,
        )
        .await
        .unwrap();
    let mut texts = Vec::new();
    let mut phases = Vec::new();
    while let Ok(event) = received.try_recv() {
        match event {
            ChatStreamEvent::Text { trace_id, text } => {
                assert_eq!(Some(trace_id), result.message.trace_id);
                texts.push(text);
            }
            ChatStreamEvent::Trace { event, .. } => phases.push(event.phase),
        }
    }
    assert_eq!(texts, vec![result.message.text]);
    assert_eq!(phases.first().map(String::as_str), Some("turn.start"));
    assert_eq!(phases.last().map(String::as_str), Some("turn.complete"));
    assert!(phases
        .iter()
        .any(|phase| phase == "tool.search_menu.complete"));
    assert!(!phases.iter().any(|phase| phase.starts_with("model.")));
}
