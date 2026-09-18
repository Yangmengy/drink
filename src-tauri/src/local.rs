//! Deterministic, explicit menu queries. No text intent inference or model calls.
use crate::{
    agent::{Companion, Reply},
    menu,
    models::*,
    settings,
    trace::Recorder,
};
use anyhow::{ensure, Result};
use std::path::Path;

impl LocalRecommendationInput {
    fn validate(&self) -> Result<()> {
        ensure!(
            self.query.query.chars().count() <= 200,
            "酒名或原料关键词最多 200 字"
        );
        for value in [
            self.query.max_sweet,
            self.query.min_sour,
            self.query.max_strong,
        ]
        .into_iter()
        .flatten()
        {
            ensure!((0..=5).contains(&value), "风味条件必须在 0–5 之间");
        }
        if let Some(id) = &self.after_trace_id {
            ensure!(uuid::Uuid::parse_str(id).is_ok(), "来源链路 ID 格式不正确");
        }
        Ok(())
    }

    fn description(&self) -> String {
        let mut conditions = vec![match self.availability {
            LocalAvailability::Ready => "材料齐全".to_owned(),
            LocalAvailability::MissingOne => "只差一种材料".to_owned(),
            LocalAvailability::Any => "按缺料从少到多".to_owned(),
        }];
        if !self.query.query.trim().is_empty() {
            conditions.push(format!("酒名或原料“{}”", self.query.query.trim()));
        }
        for (label, value) in [
            ("甜度≤", self.query.max_sweet),
            ("酸度≥", self.query.min_sour),
            ("浓烈口感≤", self.query.max_strong),
        ] {
            if let Some(value) = value {
                conditions.push(format!("{label}{value}/5"));
            }
        }
        format!("本地查酒单：{}", conditions.join("；"))
    }
}

impl Companion {
    pub async fn recommend_local(
        &self,
        directory: &Path,
        input: &LocalRecommendationInput,
    ) -> Result<LocalRecommendationResult> {
        let trace = Recorder::start_turn();
        let result = async {
            trace.push("input.validate", "校验本地查询条件");
            input.validate()?;
            let _guard = self.gate.try_lock()
                .map_err(|_| anyhow::anyhow!("正在回复上一条消息，请稍候"))?;
            // The source is an actual failed local trace, never a client-supplied reason.
            let failed_source = if let Some(id) = &input.after_trace_id {
                sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM agent_traces WHERE id=? AND status='error')")
                    .bind(id).fetch_one(&self.pool).await?
            } else { false };
            let reason = if failed_source {
                "用户在请求失败后选择本地查询"
            } else if settings::read_optional_key(directory).is_ok_and(|key| key.is_none()) {
                "未配置 API Key；用户选择本地查询"
            } else { "用户主动选择本地查询；不读取或解析自由文本偏好" };
            trace.push("fallback.start", reason);
            if let Some(id) = &input.after_trace_id {
                trace.push("fallback.source", if failed_source { format!("来源失败链路：{id}") } else { "来源链路已过期或不是失败记录；按独立本地查询处理".into() });
            }
            trace.push("fallback.query", serde_json::to_string(&input)?);
            trace.push("tool.search_menu.start", "复用菜单查询，并行读取内置/自创配方与库存");
            let mut recipes = menu::search(&self.pool, &input.query).await?;
            recipes.retain(|r| !r.ingredients.is_empty() && !r.steps.is_empty() && match input.availability {
                LocalAvailability::Ready => r.can_make,
                LocalAvailability::MissingOne => r.missing.len() == 1,
                LocalAvailability::Any => true,
            });
            let total = recipes.len();
            trace.push("tool.search_menu.complete", format!("命中 {total} 款符合全部条件的完整配方；库存仅记录材料种类"));
            recipes.truncate(3);
            let request = input.description();
            let reply_text = if recipes.is_empty() {
                format!("{request}。\n没有找到同时符合这些条件的配方。我保留了全部筛选条件，你可以调整口味或材料条件后再查，也可以先在酒柜补充已有材料。")
            } else {
                let facts = recipes.iter().map(|r| format!("{}：{}", r.name, if r.can_make { "材料种类齐全，请确认剩余用量".into() } else { format!("还缺 {}", r.missing.join("、")) })).collect::<Vec<_>>().join("\n");
                format!("{request}。\n找到 {total} 款，先列出 {} 款：\n{facts}\n这里只使用你选择的条件，没有分析聊天文字或个人偏好。", recipes.len())
            };
            let ids: Vec<_> = recipes.iter().map(|r| r.id.clone()).collect();
            trace.push("fallback.result", serde_json::to_string(&serde_json::json!({"totalMatches": total, "recipeIds": ids, "constraintsRelaxed": false}))?);
            let reply = Reply { reply: reply_text, recipe_ids: ids, trace_id: None, mode: ReplyMode::Local };
            let message = self.save_reply(&request, reply, recipes, &trace).await?;
            Ok(LocalRecommendationResult { request, message })
        }.await;
        trace.complete(&self.pool, result).await
    }
}
