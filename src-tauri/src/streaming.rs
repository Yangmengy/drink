//! The UI receives only displayable text and our sanitized trace, never raw model events.
use crate::trace::TraceEvent;
use adk_rust::{Event, Part};
use serde::Serialize;
use std::sync::Arc;

/// Tauri's Channel implements CommandArg, not Deserialize, so Option<Channel>
/// cannot be used directly. Resolve an optional JS channel with the same wire format.
pub struct OptionalChatChannel(pub Option<tauri::ipc::Channel<ChatStreamEvent>>);

impl<'de, R: tauri::Runtime> tauri::ipc::CommandArg<'de, R> for OptionalChatChannel {
    fn from_command(
        command: tauri::ipc::CommandItem<'de, R>,
    ) -> Result<Self, tauri::ipc::InvokeError> {
        let webview = command.message.webview();
        let id =
            <Option<tauri::ipc::JavaScriptChannelId> as tauri::ipc::CommandArg<R>>::from_command(
                command,
            )?;
        Ok(Self(id.map(|id| id.channel_on(webview))))
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ChatStreamEvent {
    Text {
        #[serde(rename = "traceId")]
        trace_id: String,
        text: String,
    },
    Trace {
        #[serde(rename = "traceId")]
        trace_id: String,
        event: TraceEvent,
    },
}

/// A disconnected UI must not abort a turn or change durable history.
#[derive(Clone, Default)]
pub struct StreamSink(Option<Arc<dyn Fn(ChatStreamEvent) + Send + Sync>>);

impl StreamSink {
    pub fn new(handler: impl Fn(ChatStreamEvent) + Send + Sync + 'static) -> Self {
        Self(Some(Arc::new(handler)))
    }

    pub fn from_channel(channel: Option<tauri::ipc::Channel<ChatStreamEvent>>) -> Self {
        channel
            .map(|channel| {
                Self::new(move |event| {
                    let _ = channel.send(event);
                })
            })
            .unwrap_or_default()
    }

    pub fn send(&self, event: ChatStreamEvent) {
        if let Some(handler) = &self.0 {
            handler(event);
        }
    }
}

/// ADK SSE events contain deltas, identified by a stable ID per model call.
/// Accumulation must reset after tools, rather than concatenate separate replies.
#[derive(Default)]
pub(crate) struct ReplyStream {
    event_id: Option<String>,
    raw: String,
    displayed: String,
    has_tool: bool,
    complete: bool,
    oversized: bool,
}

impl ReplyStream {
    pub fn push(&mut self, event: &Event) -> Option<String> {
        if event.author != "companion"
            || event
                .content()
                .is_some_and(|content| content.role != "model")
        {
            return None;
        }
        if self.event_id.as_deref() != Some(&event.id) {
            self.event_id = Some(event.id.clone());
            self.raw.clear();
            self.has_tool = false;
            self.complete = false;
            self.oversized = false;
        }
        if let Some(content) = event.content() {
            for part in &content.parts {
                match part {
                    Part::Text { text } => {
                        if self.raw.len().saturating_add(text.len()) > 128_000 {
                            self.oversized = true;
                        } else if !self.oversized {
                            self.raw.push_str(text);
                        }
                    }
                    Part::FunctionCall { .. } | Part::FunctionResponse { .. } => {
                        self.has_tool = true;
                    }
                    // In particular, Part::Thinking never crosses the IPC boundary.
                    _ => {}
                }
            }
        }
        if event.llm_response.turn_complete || !event.llm_response.partial {
            self.complete = true;
        }
        let next = if self.has_tool || self.oversized {
            String::new()
        } else {
            reply_prefix(&self.raw).unwrap_or_default()
        };
        if next == self.displayed {
            None
        } else {
            self.displayed = next.clone();
            Some(next)
        }
    }

    pub fn finish(self) -> anyhow::Result<String> {
        anyhow::ensure!(
            self.complete && !self.has_tool,
            "模型响应未完整结束，请重试"
        );
        anyhow::ensure!(!self.oversized, "模型返回了过长的回复");
        Ok(self.raw)
    }
}

/// Extract only the top-level `reply` string, including an unfinished string.
/// Other keys, raw JSON, nested strings and fenced prose are never shown.
fn reply_prefix(raw: &str) -> Option<String> {
    let raw = raw
        .trim_start()
        .strip_prefix("```json")
        .or_else(|| raw.trim_start().strip_prefix("```"))
        .unwrap_or(raw.trim_start())
        .trim_start();
    let mut rest = raw.strip_prefix('{')?.trim_start();
    loop {
        let (key, consumed, closed) = string_prefix(rest)?;
        if !closed {
            return None;
        }
        rest = rest[consumed..]
            .trim_start()
            .strip_prefix(':')?
            .trim_start();
        if key == "reply" {
            return string_prefix(rest).map(|(text, _, _)| text);
        }
        // Skip a complete non-reply value; do not match a nested object's `reply`.
        let mut values =
            serde_json::Deserializer::from_str(rest).into_iter::<serde::de::IgnoredAny>();
        values.next()?.ok()?;
        rest = rest[values.byte_offset()..]
            .trim_start()
            .strip_prefix(',')?
            .trim_start();
    }
}

/// Decode complete Unicode scalars only, retaining split escapes until the next chunk.
fn string_prefix(raw: &str) -> Option<(String, usize, bool)> {
    raw.strip_prefix('"')?;
    let bytes = raw.as_bytes();
    let mut index = 1;
    let mut output = String::new();
    let mut characters = 0;
    while index < bytes.len() {
        let c = raw[index..].chars().next()?;
        if c == '"' {
            return Some((output, index + 1, true));
        }
        if c == '\\' {
            if index + 1 >= bytes.len() {
                break;
            }
            let escaped = match bytes[index + 1] {
                b'"' => '"',
                b'\\' => '\\',
                b'/' => '/',
                b'b' => '\u{0008}',
                b'f' => '\u{000c}',
                b'n' => '\n',
                b'r' => '\r',
                b't' => '\t',
                b'u' => {
                    if index + 6 > bytes.len() {
                        break;
                    }
                    let high = u16::from_str_radix(raw.get(index + 2..index + 6)?, 16).ok()?;
                    let decoded = if (0xd800..=0xdbff).contains(&high) {
                        if index + 12 > bytes.len() {
                            break;
                        }
                        if &bytes[index + 6..index + 8] != b"\\u" {
                            return None;
                        }
                        let low = u16::from_str_radix(raw.get(index + 8..index + 12)?, 16).ok()?;
                        if !(0xdc00..=0xdfff).contains(&low) {
                            return None;
                        }
                        index += 6;
                        char::from_u32(
                            0x10000 + ((high as u32 - 0xd800) << 10) + (low as u32 - 0xdc00),
                        )?
                    } else {
                        char::from_u32(high as u32)?
                    };
                    index += 6;
                    output.push(decoded);
                    characters += 1;
                    if characters > 16000 {
                        return None;
                    }
                    continue;
                }
                _ => return None,
            };
            output.push(escaped);
            index += 2;
        } else {
            if c < '\u{0020}' {
                return None;
            }
            output.push(c);
            index += c.len_utf8();
        }
        characters += 1;
        if characters > 16000 {
            return None;
        }
    }
    Some((output, index, false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_only_reply_and_waits_for_split_escapes() {
        assert_eq!(
            reply_prefix(r#"{"reply":"我在，"#).as_deref(),
            Some("我在，")
        );
        assert_eq!(
            reply_prefix(r#"{"reply":"我在，\uD83C"#).as_deref(),
            Some("我在，")
        );
        assert_eq!(
            reply_prefix(r#"{"reply":"我在，\uD83C\uDF78\n\"慢慢聊\"","recipeIds":["secret"]}"#)
                .as_deref(),
            Some("我在，🍸\n\"慢慢聊\"")
        );
        assert_eq!(
            reply_prefix(r#"{"recipeIds":[],"reply":"你好"}"#).as_deref(),
            Some("你好")
        );
        assert_eq!(
            reply_prefix(r#"{"extra":{"reply":"隐藏"},"reply":"你好"}"#).as_deref(),
            Some("你好")
        );
        assert_eq!(reply_prefix(r#"{"extra":{"reply":"隐藏"}"#), None);
        assert_eq!(reply_prefix("未经结构化的内部文字"), None);
        assert_eq!(
            reply_prefix("```json\n{\"reply\":\"你好"),
            Some("你好".into())
        );
    }
}
