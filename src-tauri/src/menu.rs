use crate::models::*;
use anyhow::{bail, ensure, Result};
use sqlx::{Row, SqliteConnection, SqlitePool};
use std::collections::HashSet;

pub async fn inventory(pool: &SqlitePool) -> Result<Vec<Ingredient>> {
    Ok(sqlx::query_as::<_, Ingredient>(
        "SELECT i.id, i.name_zh AS name, i.category, EXISTS(SELECT 1 FROM user_inventory u WHERE u.ingredient_id=i.id) AS owned FROM ingredients i ORDER BY owned DESC, i.name_zh"
    ).fetch_all(pool).await?)
}

async fn find_or_create_ingredient(
    connection: &mut SqliteConnection,
    name: &str,
    category: &str,
) -> Result<(Ingredient, bool)> {
    let name = name.trim();
    let normalized = name.to_lowercase();
    // Rust normalization also handles Unicode case and whitespace that SQLite NOCASE/trim do not.
    let existing = sqlx::query_as::<_, Ingredient>(
        "SELECT i.id, i.name_zh AS name, i.category, EXISTS(SELECT 1 FROM user_inventory u WHERE u.ingredient_id=i.id) AS owned FROM ingredients i ORDER BY owned DESC, i.created_at, i.id",
    )
    .fetch_all(&mut *connection)
    .await?
    .into_iter()
    .find(|ingredient| ingredient.name.trim().to_lowercase() == normalized);
    if let Some(ingredient) = existing {
        return Ok((ingredient, false));
    }
    let ingredient = Ingredient {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_owned(),
        category: category.to_owned(),
        owned: false,
    };
    sqlx::query("INSERT INTO ingredients (id,name_zh,name_key,category,created_at,updated_at) VALUES (?,?,?,?,strftime('%s','now'),strftime('%s','now'))")
        .bind(&ingredient.id)
        .bind(&ingredient.name)
        .bind(&normalized)
        .bind(&ingredient.category)
        .execute(&mut *connection)
        .await?;
    Ok((ingredient, true))
}

pub async fn add_ingredient(
    pool: &SqlitePool,
    input: &NewIngredientInput,
) -> Result<AddIngredientResult> {
    let name = input.name.trim();
    ensure!(
        !name.is_empty() && name.chars().count() <= 80,
        "请填写 1–80 字的原料名称"
    );
    ensure!(
        matches!(
            input.category.as_str(),
            "spirits"
                | "liqueur"
                | "juice"
                | "syrup"
                | "herb"
                | "mixer"
                | "dairy"
                | "fruit"
                | "other"
        ),
        "请选择有效的原料分类"
    );
    // Reserve the writer before lookup: old databases have no unique normalized-name index.
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let (mut ingredient, created) =
        find_or_create_ingredient(&mut tx, name, &input.category).await?;
    if input.owned && !ingredient.owned {
        sqlx::query("INSERT INTO user_inventory (id,ingredient_id,added_at,updated_at) VALUES (?,?,strftime('%s','now'),strftime('%s','now'))")
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&ingredient.id)
            .execute(&mut *tx)
            .await?;
        ingredient.owned = true;
    }
    tx.commit().await?;
    Ok(AddIngredientResult {
        ingredient,
        created,
    })
}

pub async fn set_inventory(pool: &SqlitePool, id: &str, owned: bool) -> Result<()> {
    let mut tx = pool.begin().await?;
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM ingredients WHERE id=?)")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    ensure!(exists, "原料不存在");
    // An atomic transaction makes repeat clicks idempotent even on old databases without a unique index.
    sqlx::query("DELETE FROM user_inventory WHERE ingredient_id=?")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    if owned {
        sqlx::query("INSERT INTO user_inventory (id,ingredient_id,added_at,updated_at) VALUES (?,?,strftime('%s','now'),strftime('%s','now'))")
            .bind(uuid::Uuid::new_v4().to_string()).bind(id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Read the menu independently of inventory so both reads can run concurrently.
async fn read_menu(pool: &SqlitePool) -> Result<Vec<Recipe>> {
    let rows = sqlx::query("SELECT id,name_zh,name_en,description,category,source,image_url,method,flavor_profile FROM recipes ORDER BY updated_at DESC, name_zh")
        .fetch_all(pool).await?;
    let ingredients = sqlx::query("SELECT ri.recipe_id, i.id, i.name_zh AS name, ri.amount, ri.unit, ri.is_optional AS optional FROM recipe_ingredients ri JOIN ingredients i ON i.id=ri.ingredient_id ORDER BY ri.display_order, ri.rowid")
        .fetch_all(pool).await?;
    let steps = sqlx::query("SELECT recipe_id,instruction FROM recipe_steps ORDER BY step_number")
        .fetch_all(pool)
        .await?;
    let mut recipes = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let mut items = Vec::new();
        for i in &ingredients {
            if i.get::<String, _>("recipe_id") == id {
                items.push(RecipeIngredient {
                    id: i.get("id"),
                    name: i.get("name"),
                    amount: i.get("amount"),
                    unit: i.get("unit"),
                    optional: i.get("optional"),
                });
            }
        }
        let flavor: Option<String> = row.get("flavor_profile");
        recipes.push(Recipe {
            steps: steps
                .iter()
                .filter(|s| s.get::<String, _>("recipe_id") == id)
                .map(|s| s.get("instruction"))
                .collect(),
            id,
            name: row.get("name_zh"),
            name_en: row.get::<Option<String>, _>("name_en").unwrap_or_default(),
            description: row
                .get::<Option<String>, _>("description")
                .unwrap_or_default(),
            category: row.get("category"),
            source: if row.get::<Option<String>, _>("source").as_deref() == Some("custom") {
                "custom"
            } else {
                "builtin"
            }
            .into(),
            image: row.get("image_url"),
            method: row.get::<Option<String>, _>("method").unwrap_or_default(),
            flavor: flavor.and_then(|s| serde_json::from_str(&s).ok()),
            ingredients: items,
            missing: vec![],
            can_make: false,
        });
    }
    Ok(recipes)
}

pub async fn search(pool: &SqlitePool, query: &MenuQuery) -> Result<Vec<Recipe>> {
    ensure!(query.query.chars().count() <= 200, "搜索词过长");
    // The two independent reads implement the companion workflow's parallel recall.
    let (mut recipes, inventory) = tokio::try_join!(read_menu(pool), inventory(pool))?;
    let owned: HashSet<_> = inventory
        .iter()
        .filter(|i| i.owned)
        .map(|i| i.id.as_str())
        .collect();
    let q = query.query.trim().to_lowercase();
    for r in &mut recipes {
        r.missing = r
            .ingredients
            .iter()
            .filter(|i| !i.optional && !owned.contains(i.id.as_str()))
            .map(|i| i.name.clone())
            .collect();
        r.can_make = !r.ingredients.is_empty() && r.missing.is_empty();
    }
    recipes.retain(|r| {
        let haystack = format!(
            "{} {} {} {} {}",
            r.name,
            r.name_en,
            r.description,
            r.category,
            r.ingredients
                .iter()
                .map(|i| i.name.as_str())
                .collect::<Vec<_>>()
                .join(" ")
        )
        .to_lowercase();
        let flavor_matches = match &r.flavor {
            Some(f) => {
                query.max_sweet.is_none_or(|v| f.sweet <= v)
                    && query.min_sour.is_none_or(|v| f.sour >= v)
                    && query.max_strong.is_none_or(|v| f.strong <= v)
            }
            None => {
                query.max_sweet.is_none() && query.min_sour.is_none() && query.max_strong.is_none()
            }
        };
        (q.is_empty() || haystack.contains(&q)) && flavor_matches
    });
    recipes.sort_by_key(|r| (!r.can_make, r.missing.len()));
    Ok(recipes)
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<Recipe> {
    search(pool, &MenuQuery::default())
        .await?
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| anyhow::anyhow!("酒单中没有这款酒，可能已被删除"))
}

pub async fn save_custom(pool: &SqlitePool, input: &RecipeInput) -> Result<String> {
    ensure!(
        !input.name.trim().is_empty() && input.name.chars().count() <= 80,
        "请填写 1–80 字的酒品名称"
    );
    ensure!(
        input.description.chars().count() <= 2000 && input.method.chars().count() <= 80,
        "描述或调制方法过长"
    );
    ensure!(
        !input.ingredients.is_empty() && input.ingredients.len() <= 30,
        "请填写 1–30 种原料"
    );
    ensure!(
        !input.steps.is_empty()
            && input.steps.len() <= 30
            && input
                .steps
                .iter()
                .all(|s| !s.trim().is_empty() && s.chars().count() <= 1000),
        "请填写有效的制作步骤"
    );
    for v in [
        input.flavor.sweet,
        input.flavor.sour,
        input.flavor.bitter,
        input.flavor.strong,
    ] {
        ensure!((0..=5).contains(&v), "风味值必须在 0–5 之间");
    }
    let mut names = HashSet::new();
    for i in &input.ingredients {
        ensure!(
            !i.name.trim().is_empty() && i.name.trim().chars().count() <= 80,
            "原料名称不能为空或过长"
        );
        ensure!(
            names.insert(i.name.trim().to_lowercase()),
            "同一配方不能重复填写相同原料"
        );
        ensure!(
            i.amount.is_finite() && i.amount > 0.0 && i.amount <= 10000.0,
            "原料用量必须大于 0 且不超过 10000"
        );
        ensure!(
            !i.unit.trim().is_empty() && i.unit.chars().count() <= 16,
            "请填写有效单位"
        );
    }
    let id = input
        .id
        .clone()
        .unwrap_or_else(|| format!("custom-{}", uuid::Uuid::new_v4()));
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    if input.id.is_some() {
        let source: Option<String> = sqlx::query_scalar("SELECT source FROM recipes WHERE id=?")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();
        ensure!(source.as_deref() == Some("custom"), "只能编辑自己的配方");
        sqlx::query("UPDATE recipes SET name_zh=?,description=?,method=?,flavor_profile=?,updated_at=strftime('%s','now') WHERE id=?")
            .bind(input.name.trim()).bind(input.description.trim()).bind(input.method.trim()).bind(serde_json::to_string(&input.flavor)?).bind(&id).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM recipe_ingredients WHERE recipe_id=?")
            .bind(&id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM recipe_steps WHERE recipe_id=?")
            .bind(&id)
            .execute(&mut *tx)
            .await?;
    } else {
        sqlx::query("INSERT INTO recipes (id,name_zh,category,source,description,method,flavor_profile,created_at,updated_at) VALUES (?,?,'自创','custom',?,?,?,strftime('%s','now'),strftime('%s','now'))")
            .bind(&id).bind(input.name.trim()).bind(input.description.trim()).bind(input.method.trim()).bind(serde_json::to_string(&input.flavor)?).execute(&mut *tx).await?;
    }
    for (n, i) in input.ingredients.iter().enumerate() {
        let (ingredient, _) = find_or_create_ingredient(&mut tx, &i.name, "other").await?;
        sqlx::query("INSERT INTO recipe_ingredients (id,recipe_id,ingredient_id,amount,unit,is_optional,display_order,created_at) VALUES (?,?,?,?,?,?,?,strftime('%s','now'))")
            .bind(uuid::Uuid::new_v4().to_string()).bind(&id).bind(ingredient.id).bind(i.amount).bind(i.unit.trim()).bind(i.optional).bind(n as i32).execute(&mut *tx).await?;
    }
    for (n, step) in input.steps.iter().enumerate() {
        sqlx::query("INSERT INTO recipe_steps (id,recipe_id,step_number,instruction,created_at) VALUES (?,?,?,?,strftime('%s','now'))")
            .bind(uuid::Uuid::new_v4().to_string()).bind(&id).bind(n as i32+1).bind(step.trim()).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(id)
}

pub async fn delete_custom(pool: &SqlitePool, id: &str) -> Result<()> {
    let result = sqlx::query("DELETE FROM recipes WHERE id=? AND source='custom'")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        bail!("只能删除自己的配方");
    }
    Ok(())
}
