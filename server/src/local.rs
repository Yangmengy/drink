//! Web 版本地酒单查询：确定性的条件筛选，不读取模型、不解析自由文本。
use crate::{error::AppError, menu, models::*};
use sqlx::PgPool;

fn validate(input: &LocalRecommendationInput) -> Result<(), AppError> {
    if input.query.query.chars().count() > 200 {
        return Err(AppError::bad_request("酒名或原料关键词最多 200 字"));
    }
    for value in [
        input.query.max_sweet,
        input.query.min_sour,
        input.query.max_strong,
    ]
    .into_iter()
    .flatten()
    {
        if !(0..=5).contains(&value) {
            return Err(AppError::bad_request("风味条件必须在 0–5 之间"));
        }
    }
    if let Some(id) = &input.after_trace_id {
        uuid::Uuid::parse_str(id).map_err(|_| AppError::bad_request("来源链路 ID 格式不正确"))?;
    }
    Ok(())
}

fn description(input: &LocalRecommendationInput) -> String {
    let mut conditions = vec![match input.availability {
        LocalAvailability::Ready => "材料齐全".to_owned(),
        LocalAvailability::MissingOne => "只差一种材料".to_owned(),
        LocalAvailability::Any => "按缺料从少到多".to_owned(),
    }];
    if !input.query.query.trim().is_empty() {
        conditions.push(format!("酒名或原料“{}”", input.query.query.trim()));
    }
    for (label, value) in [
        ("甜度≤", input.query.max_sweet),
        ("酸度≥", input.query.min_sour),
        ("浓烈口感≤", input.query.max_strong),
    ] {
        if let Some(value) = value {
            conditions.push(format!("{label}{value}/5"));
        }
    }
    format!("本地查酒单：{}", conditions.join("；"))
}

fn reply_text(input: &LocalRecommendationInput, total: usize, recipes: &[Recipe]) -> String {
    let request = description(input);
    if recipes.is_empty() {
        return format!("{request}。\n没有找到同时符合这些条件的配方。我保留了全部筛选条件，你可以调整口味或材料条件后再查，也可以先在酒柜补充已有材料。");
    }
    let facts = recipes
        .iter()
        .map(|recipe| {
            if recipe.can_make {
                format!("{}：材料种类齐全，请确认剩余用量", recipe.name)
            } else {
                format!("{}：还缺 {}", recipe.name, recipe.missing.join("、"))
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "{request}。\n找到 {total} 款，先列出 {} 款：\n{facts}\n这里只使用你选择的条件，没有分析聊天文字或个人偏好。",
        recipes.len()
    )
}

pub async fn recommend(
    pool: &PgPool,
    user_id: uuid::Uuid,
    input: &LocalRecommendationInput,
) -> Result<LocalRecommendationResult, AppError> {
    validate(input)?;
    let mut recipes = menu::search(pool, user_id, &input.query).await?;
    recipes.retain(|recipe| {
        !recipe.ingredients.is_empty()
            && !recipe.steps.is_empty()
            && match input.availability {
                LocalAvailability::Ready => recipe.can_make,
                LocalAvailability::MissingOne => recipe.missing.len() == 1,
                LocalAvailability::Any => true,
            }
    });
    let total = recipes.len();
    recipes.truncate(3);
    let message = LocalReplyMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "assistant".to_owned(),
        text: reply_text(input, total, &recipes),
        recipes: recipes.clone(),
        trace_id: None,
        mode: "local".to_owned(),
    };
    Ok(LocalRecommendationResult {
        request: description(input),
        message,
    })
}
