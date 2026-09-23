use crate::{error::AppError, models::*, profile};
use sqlx::{PgConnection, PgPool, Row};
use std::collections::{HashMap, HashSet};

pub async fn inventory(pool: &PgPool, user_id: uuid::Uuid) -> Result<Vec<Ingredient>, AppError> {
    let rows = sqlx::query_as::<_, Ingredient>(
        r#"
        SELECT i.id,
               i.name_zh AS name,
               i.category,
               EXISTS (
                   SELECT 1 FROM user_inventory u
                   WHERE u.user_id = $1 AND u.ingredient_id = i.id
               ) AS owned
        FROM ingredients i
        WHERE i.user_id = $1 OR i.user_id IS NULL
        ORDER BY owned DESC, i.name_zh
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

async fn visible_ingredients(
    connection: &mut PgConnection,
    user_id: uuid::Uuid,
) -> Result<Vec<Ingredient>, AppError> {
    sqlx::query_as::<_, Ingredient>(
        r#"
        SELECT i.id,
               i.name_zh AS name,
               i.category,
               EXISTS (
                   SELECT 1 FROM user_inventory u
                   WHERE u.user_id = $1 AND u.ingredient_id = i.id
               ) AS owned
        FROM ingredients i
        WHERE i.user_id = $1 OR i.user_id IS NULL
        ORDER BY i.created_at, i.id
        "#,
    )
    .bind(user_id)
    .fetch_all(&mut *connection)
    .await
    .map_err(Into::into)
}

async fn find_or_create_ingredient(
    connection: &mut PgConnection,
    user_id: uuid::Uuid,
    name: &str,
    category: &str,
) -> Result<(Ingredient, bool), AppError> {
    let name = name.trim();
    let normalized = name.to_lowercase();
    let existing = visible_ingredients(connection, user_id)
        .await?
        .into_iter()
        .find(|ingredient| ingredient.name.trim().to_lowercase() == normalized);
    if let Some(ingredient) = existing {
        return Ok((ingredient, false));
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO ingredients (id, user_id, name_zh, name_key, category)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(&id)
    .bind(user_id)
    .bind(name)
    .bind(&normalized)
    .bind(category)
    .execute(&mut *connection)
    .await
    .map_err(|error| match error {
        sqlx::Error::Database(database_error) if database_error.is_unique_violation() => {
            AppError::conflict("原料名称已存在")
        }
        error => error.into(),
    })?;

    Ok((
        Ingredient {
            id,
            name: name.to_owned(),
            category: category.to_owned(),
            owned: false,
        },
        true,
    ))
}

pub async fn add_ingredient(
    pool: &PgPool,
    user_id: uuid::Uuid,
    input: &NewIngredientInput,
) -> Result<AddIngredientResult, AppError> {
    let name = input.name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(AppError::bad_request("请填写 1–80 字的原料名称"));
    }
    if !matches!(
        input.category.as_str(),
        "spirits" | "liqueur" | "juice" | "syrup" | "herb" | "mixer" | "dairy" | "fruit" | "other"
    ) {
        return Err(AppError::bad_request("请选择有效的原料分类"));
    }

    let mut transaction = pool.begin().await?;
    let (mut ingredient, created) =
        find_or_create_ingredient(&mut transaction, user_id, name, &input.category).await?;
    if input.owned && !ingredient.owned {
        sqlx::query("INSERT INTO user_inventory (user_id, ingredient_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(&ingredient.id)
            .execute(&mut *transaction)
            .await?;
        ingredient.owned = true;
    }
    transaction.commit().await?;
    Ok(AddIngredientResult {
        ingredient,
        created,
    })
}

pub async fn set_inventory(
    pool: &PgPool,
    user_id: uuid::Uuid,
    ingredient_id: &str,
    owned: bool,
) -> Result<(), AppError> {
    let mut transaction = pool.begin().await?;
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM ingredients
            WHERE id = $2 AND (user_id = $1 OR user_id IS NULL)
        )
        "#,
    )
    .bind(user_id)
    .bind(ingredient_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !exists {
        return Err(AppError::not_found("原料不存在"));
    }

    if owned {
        sqlx::query(
            r#"
            INSERT INTO user_inventory (user_id, ingredient_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, ingredient_id) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(ingredient_id)
        .execute(&mut *transaction)
        .await?;
    } else {
        sqlx::query("DELETE FROM user_inventory WHERE user_id = $1 AND ingredient_id = $2")
            .bind(user_id)
            .bind(ingredient_id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(())
}

async fn read_menu(pool: &PgPool, user_id: uuid::Uuid) -> Result<Vec<Recipe>, AppError> {
    let recipe_rows = sqlx::query(
        r#"
        SELECT id, name_zh, name_en, description, category, source, image_url, method, flavor_profile
        FROM recipes
        WHERE user_id = $1 OR user_id IS NULL
        ORDER BY updated_at DESC, name_zh
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    let ingredient_rows = sqlx::query(
        r#"
        SELECT ri.id,
               i.id AS ingredient_id,
               ri.recipe_id,
               i.name_zh AS name,
               ri.amount,
               ri.unit,
               ri.is_optional AS optional
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        ORDER BY ri.display_order NULLS LAST, ri.created_at, ri.id
        "#,
    )
    .fetch_all(pool)
    .await?;
    let step_rows =
        sqlx::query("SELECT recipe_id, instruction FROM recipe_steps ORDER BY step_number, id")
            .fetch_all(pool)
            .await?;

    let mut recipes = Vec::with_capacity(recipe_rows.len());
    for row in recipe_rows {
        let id: String = row.get("id");
        let flavor: Option<serde_json::Value> = row.get("flavor_profile");
        let ingredients = ingredient_rows
            .iter()
            .filter(|item| item.get::<String, _>("recipe_id") == id)
            .map(|item| RecipeIngredient {
                id: item.get("id"),
                ingredient_id: item.get("ingredient_id"),
                name: item.get("name"),
                amount: item.get("amount"),
                unit: item.get("unit"),
                optional: item.get("optional"),
            })
            .collect();
        recipes.push(Recipe {
            steps: step_rows
                .iter()
                .filter(|step| step.get::<String, _>("recipe_id") == id)
                .map(|step| step.get("instruction"))
                .collect(),
            id,
            name: row.get("name_zh"),
            name_en: row.get::<Option<String>, _>("name_en").unwrap_or_default(),
            description: row
                .get::<Option<String>, _>("description")
                .unwrap_or_default(),
            category: row.get("category"),
            source: if row.get::<Option<String>, _>("source").as_deref() == Some("custom") {
                "custom".to_owned()
            } else {
                "builtin".to_owned()
            },
            image: row.get("image_url"),
            method: row.get::<Option<String>, _>("method").unwrap_or_default(),
            flavor: flavor.and_then(|value| serde_json::from_value(value).ok()),
            ingredients,
            missing: Vec::new(),
            can_make: false,
            score: 0.0,
        });
    }
    Ok(recipes)
}

pub async fn search(
    pool: &PgPool,
    user_id: uuid::Uuid,
    query: &MenuQuery,
) -> Result<Vec<Recipe>, AppError> {
    if query.query.chars().count() > 200 {
        return Err(AppError::bad_request("搜索词过长"));
    }

    let (mut recipes, inventory) =
        tokio::try_join!(read_menu(pool, user_id), inventory(pool, user_id))?;
    let profile = profile::projection(pool, user_id).await?;
    let owned: HashSet<String> = inventory
        .iter()
        .filter(|ingredient| ingredient.owned)
        .map(|ingredient| ingredient.id.clone())
        .collect();
    let keyword = query.query.trim().to_lowercase();

    for recipe in &mut recipes {
        recipe.missing = recipe
            .ingredients
            .iter()
            .filter(|item| !item.optional && !owned.contains(&item.ingredient_id))
            .map(|item| item.name.clone())
            .collect();
        recipe.can_make = !recipe.ingredients.is_empty() && recipe.missing.is_empty();
    }

    recipes.retain(|recipe| {
        let haystack = format!(
            "{} {} {} {} {}",
            recipe.name,
            recipe.name_en,
            recipe.description,
            recipe.category,
            recipe
                .ingredients
                .iter()
                .map(|item| item.name.as_str())
                .collect::<Vec<_>>()
                .join(" ")
        )
        .to_lowercase();
        let flavor_matches = match &recipe.flavor {
            Some(flavor) => {
                query.max_sweet.is_none_or(|value| flavor.sweet <= value)
                    && query.min_sour.is_none_or(|value| flavor.sour >= value)
                    && query.max_strong.is_none_or(|value| flavor.strong <= value)
            }
            None => {
                query.max_sweet.is_none() && query.min_sour.is_none() && query.max_strong.is_none()
            }
        };
        (keyword.is_empty() || haystack.contains(&keyword)) && flavor_matches
    });

    let ingredient_categories: HashMap<String, String> =
        sqlx::query("SELECT id, category FROM ingredients WHERE user_id = $1 OR user_id IS NULL")
            .bind(user_id)
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|row| {
                let id: String = row.get("id");
                let category: String = row.get("category");
                (id, category)
            })
            .collect();

    recipes.retain(|recipe| {
        !profile.constraints.no_alcohol
            || !recipe.ingredients.iter().any(|item| {
                ingredient_categories
                    .get(&item.ingredient_id)
                    .is_some_and(|category: &String| {
                        matches!(category.as_str(), "spirits" | "liqueur" | "wine" | "beer")
                    })
            })
    });
    let allergens: Vec<String> = profile
        .constraints
        .allergies
        .iter()
        .chain(profile.constraints.avoid_ingredients.iter())
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
        .collect();
    if !allergens.is_empty() {
        recipes.retain(|recipe| {
            !recipe.ingredients.iter().any(|item| {
                let name = item.name.trim().to_lowercase();
                allergens.iter().any(|allergen| {
                    name.contains(allergen.as_str()) || allergen.contains(name.as_str())
                })
            })
        });
    }
    rank_by_profile(&mut recipes, &profile);
    Ok(recipes)
}

fn rank_by_profile(recipes: &mut [Recipe], profile: &profile::Projection) {
    let flavor_confidence = [
        profile.confidence.flavor.sweet,
        profile.confidence.flavor.sour,
        profile.confidence.flavor.bitter,
        profile.confidence.flavor.strong,
    ]
    .iter()
    .sum::<f64>()
        / 4.0;
    let default_flavor = profile::FlavorPreference::default();
    for recipe in &mut *recipes {
        let target = profile.preferences.flavor.clone();
        let flavor = recipe
            .flavor
            .clone()
            .map_or(default_flavor.clone(), |flavor| profile::FlavorPreference {
                sweet: flavor.sweet as f64,
                sour: flavor.sour as f64,
                bitter: flavor.bitter as f64,
                strong: flavor.strong as f64,
            });
        let difference = (target.sweet - flavor.sweet).abs()
            + (target.sour - flavor.sour).abs()
            + (target.bitter - flavor.bitter).abs()
            + (target.strong - flavor.strong).abs();
        let flavor_score = 1.0 - difference / 20.0;
        let availability_score = if recipe.can_make {
            1.0
        } else {
            (1.0 - recipe.missing.len().min(3) as f64 * 0.25).max(0.0)
        };
        let profile_score = flavor_score * (0.25 + flavor_confidence * 0.45);
        recipe.score = profile_score + availability_score;
    }
    recipes.sort_by(|left, right| {
        right
            .score
            .partial_cmp(&left.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(right.can_make.cmp(&left.can_make))
            .then(left.missing.len().cmp(&right.missing.len()))
    });
}

pub async fn get(pool: &PgPool, user_id: uuid::Uuid, id: &str) -> Result<Recipe, AppError> {
    search(pool, user_id, &MenuQuery::default())
        .await?
        .into_iter()
        .find(|recipe| recipe.id == id)
        .ok_or_else(|| AppError::not_found("酒单中没有这款酒，可能已被删除"))
}

fn validate_recipe_input(input: &RecipeInput) -> Result<(), AppError> {
    if input.name.trim().is_empty() || input.name.chars().count() > 80 {
        return Err(AppError::bad_request("请填写 1–80 字的酒品名称"));
    }
    if input.description.chars().count() > 2000 || input.method.chars().count() > 80 {
        return Err(AppError::bad_request("描述或调制方法过长"));
    }
    if input.ingredients.is_empty() || input.ingredients.len() > 30 {
        return Err(AppError::bad_request("请填写 1–30 种原料"));
    }
    if input.steps.is_empty()
        || input.steps.len() > 30
        || input
            .steps
            .iter()
            .any(|step| step.trim().is_empty() || step.chars().count() > 1000)
    {
        return Err(AppError::bad_request("请填写有效的制作步骤"));
    }
    for value in [
        input.flavor.sweet,
        input.flavor.sour,
        input.flavor.bitter,
        input.flavor.strong,
    ] {
        if !(0..=5).contains(&value) {
            return Err(AppError::bad_request("风味值必须在 0–5 之间"));
        }
    }

    let mut names = HashSet::new();
    for ingredient in &input.ingredients {
        let name = ingredient.name.trim();
        if name.is_empty() || name.chars().count() > 80 {
            return Err(AppError::bad_request("原料名称不能为空或过长"));
        }
        if !names.insert(name.to_lowercase()) {
            return Err(AppError::bad_request("同一配方不能重复填写相同原料"));
        }
        if !ingredient.amount.is_finite() || ingredient.amount <= 0.0 || ingredient.amount > 10000.0
        {
            return Err(AppError::bad_request("原料用量必须大于 0 且不超过 10000"));
        }
        let unit = ingredient.unit.trim();
        if unit.is_empty() || unit.chars().count() > 16 {
            return Err(AppError::bad_request("请填写有效单位"));
        }
    }
    Ok(())
}

pub async fn save_custom(
    pool: &PgPool,
    user_id: uuid::Uuid,
    input: &RecipeInput,
) -> Result<String, AppError> {
    validate_recipe_input(input)?;
    let id = input
        .id
        .clone()
        .unwrap_or_else(|| format!("custom-{}", uuid::Uuid::new_v4()));
    let flavor = serde_json::to_value(&input.flavor).map_err(|_| AppError::internal())?;
    let mut transaction = pool.begin().await?;

    if input.id.is_some() {
        let owned: Option<Option<uuid::Uuid>> = sqlx::query_scalar(
            "SELECT user_id FROM recipes WHERE id = $1 AND source = 'custom' FOR UPDATE",
        )
        .bind(&id)
        .fetch_optional(&mut *transaction)
        .await?;
        if owned.flatten() != Some(user_id) {
            return Err(AppError::forbidden("只能编辑自己的配方"));
        }
        sqlx::query(
            r#"
            UPDATE recipes
            SET name_zh = $2, description = $3, method = $4,
                flavor_profile = $5,
                name_key = LOWER(TRIM($2)),
                updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
            WHERE id = $1
            "#,
        )
        .bind(&id)
        .bind(input.name.trim())
        .bind(input.description.trim())
        .bind(input.method.trim())
        .bind(&flavor)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("DELETE FROM recipe_ingredients WHERE recipe_id = $1")
            .bind(&id)
            .execute(&mut *transaction)
            .await?;
        sqlx::query("DELETE FROM recipe_steps WHERE recipe_id = $1")
            .bind(&id)
            .execute(&mut *transaction)
            .await?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO recipes (id, user_id, name_zh, name_key, category, source, description, method, flavor_profile)
            VALUES ($1, $2, $3, LOWER(TRIM($3)), '自创', 'custom', $4, $5, $6)
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(input.name.trim())
        .bind(input.description.trim())
        .bind(input.method.trim())
        .bind(&flavor)
        .execute(&mut *transaction)
        .await?;
    }

    for (index, ingredient) in input.ingredients.iter().enumerate() {
        let (found, _) =
            find_or_create_ingredient(&mut transaction, user_id, &ingredient.name, "other").await?;
        sqlx::query(
            r#"
            INSERT INTO recipe_ingredients
                (id, recipe_id, ingredient_id, amount, unit, is_optional, display_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(&found.id)
        .bind(ingredient.amount)
        .bind(ingredient.unit.trim())
        .bind(ingredient.optional)
        .bind(index as i32 + 1)
        .execute(&mut *transaction)
        .await?;
    }
    for (index, step) in input.steps.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO recipe_steps (id, recipe_id, step_number, instruction)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&id)
        .bind(index as i32 + 1)
        .bind(step.trim())
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(id)
}

pub async fn delete_custom(pool: &PgPool, user_id: uuid::Uuid, id: &str) -> Result<(), AppError> {
    let result =
        sqlx::query("DELETE FROM recipes WHERE id = $1 AND source = 'custom' AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::forbidden("只能删除自己的配方"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> RecipeInput {
        RecipeInput {
            id: None,
            name: "Test".to_owned(),
            description: String::new(),
            method: String::new(),
            flavor: Flavor {
                sweet: 1,
                sour: 1,
                bitter: 0,
                strong: 2,
            },
            ingredients: vec![IngredientInput {
                name: "Gin".to_owned(),
                amount: 30.0,
                unit: "ml".to_owned(),
                optional: false,
            }],
            steps: vec!["Stir".to_owned()],
        }
    }

    #[test]
    fn recipe_validation_rejects_bad_values() {
        assert!(validate_recipe_input(&input()).is_ok());
        let mut invalid = input();
        invalid.ingredients.clear();
        assert!(validate_recipe_input(&invalid).is_err());
        let mut invalid = input();
        invalid.ingredients[0].amount = 0.0;
        assert!(validate_recipe_input(&invalid).is_err());
    }
}
