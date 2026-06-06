use sqlx::SqlitePool;
use crate::models::{Recipe, RecipeDetail, RecipeFilter, RecipeIngredient, RecipeIngredientDetail, RecipeStep, SearchArgs, Ingredient};
use crate::error::AppError;

pub struct RecipeRepository;

impl RecipeRepository {
    /// 搜索配方
    pub async fn search(args: &SearchArgs, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let mut query = String::from("SELECT * FROM recipes WHERE 1=1");
        
        // 如果有搜索关键词，使用 FTS 全文搜索
        if let Some(q) = &args.query {
            if !q.is_empty() {
                query = format!(
                    "SELECT r.* FROM recipes r 
                     JOIN recipes_fts f ON r.id = f.recipe_id 
                     WHERE recipes_fts MATCH ? "
                );
            }
        }
        
        // 分类过滤
        if let Some(category) = &args.category {
            query.push_str(&format!(" AND category = '{}'", category));
        }
        
        // 难度过滤
        if let Some(difficulty) = args.difficulty {
            query.push_str(&format!(" AND difficulty = {}", difficulty));
        }
        
        // 酒精度过滤
        if let Some(max_abv) = args.max_abv {
            query.push_str(&format!(" AND (abv IS NULL OR abv <= {})", max_abv));
        }
        
        // IBA 筛选
        if let Some(is_iba) = args.is_iba {
            query.push_str(&format!(" AND is_iba = {}", if is_iba { 1 } else { 0 }));
        }
        
        // 限制数量
        let limit = args.limit.unwrap_or(50);
        query.push_str(&format!(" LIMIT {}", limit));
        
        let recipes = if let Some(q) = &args.query {
            if !q.is_empty() {
                sqlx::query_as::<_, Recipe>(&query)
                    .bind(q)
                    .fetch_all(pool)
                    .await?
            } else {
                sqlx::query_as::<_, Recipe>(&query)
                    .fetch_all(pool)
                    .await?
            }
        } else {
            sqlx::query_as::<_, Recipe>(&query)
                .fetch_all(pool)
                .await?
        };
        
        Ok(recipes)
    }

    /// 根据 ID 获取配方详情
    pub async fn get_by_id(id: &str, pool: &SqlitePool) -> Result<Option<RecipeDetail>, AppError> {
        // 获取配方基本信息
        let recipe = sqlx::query_as::<_, Recipe>(
            "SELECT * FROM recipes WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;
        
        if recipe.is_none() {
            return Ok(None);
        }
        
        let recipe = recipe.unwrap();
        
        // 获取配方原料
        let recipe_ingredients = sqlx::query_as::<_, RecipeIngredient>(
            "SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY display_order"
        )
        .bind(id)
        .fetch_all(pool)
        .await?;
        
        // 获取每个原料的详细信息
        let mut ingredients_detail = Vec::new();
        for ri in recipe_ingredients {
            let ingredient = sqlx::query_as::<_, Ingredient>(
                "SELECT * FROM ingredients WHERE id = ?"
            )
            .bind(&ri.ingredient_id)
            .fetch_one(pool)
            .await?;
            
            ingredients_detail.push(RecipeIngredientDetail {
                recipe_ingredient: ri,
                ingredient,
            });
        }
        
        // 获取制作步骤
        let steps = sqlx::query_as::<_, RecipeStep>(
            "SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number"
        )
        .bind(id)
        .fetch_all(pool)
        .await?;
        
        Ok(Some(RecipeDetail {
            recipe,
            ingredients: ingredients_detail,
            steps,
        }))
    }

    /// 获取配方列表（带过滤）
    pub async fn get_list(filter: Option<RecipeFilter>, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let mut query = String::from("SELECT * FROM recipes WHERE 1=1");
        
        if let Some(f) = filter {
            if let Some(category) = f.category {
                query.push_str(&format!(" AND category = '{}'", category));
            }
            if let Some(difficulty) = f.difficulty {
                query.push_str(&format!(" AND difficulty = {}", difficulty));
            }
            if let Some(is_iba) = f.is_iba {
                query.push_str(&format!(" AND is_iba = {}", if is_iba { 1 } else { 0 }));
            }
            if let Some(is_favorite) = f.is_favorite {
                query.push_str(&format!(" AND is_favorite = {}", if is_favorite { 1 } else { 0 }));
            }
        }
        
        query.push_str(" ORDER BY updated_at DESC LIMIT 5000");
        
        let recipes = sqlx::query_as::<_, Recipe>(&query)
            .fetch_all(pool)
            .await?;
        
        Ok(recipes)
    }

    /// 获取推荐配方
    pub async fn get_recommended(limit: i32, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let recipes = sqlx::query_as::<_, Recipe>(
            "SELECT * FROM recipes 
             WHERE is_iba = 1 
             ORDER BY view_count DESC, difficulty ASC 
             LIMIT ?"
        )
        .bind(limit)
        .fetch_all(pool)
        .await?;
        
        Ok(recipes)
    }

    /// 获取收藏的配方
    pub async fn get_favorites(pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let recipes = sqlx::query_as::<_, Recipe>(
            "SELECT * FROM recipes WHERE is_favorite = 1 ORDER BY updated_at DESC"
        )
        .fetch_all(pool)
        .await?;
        
        Ok(recipes)
    }

    /// 切换收藏状态
    pub async fn toggle_favorite(recipe_id: &str, pool: &SqlitePool) -> Result<bool, AppError> {
        // 获取当前收藏状态
        let current: bool = sqlx::query_scalar(
            "SELECT is_favorite FROM recipes WHERE id = ?"
        )
        .bind(recipe_id)
        .fetch_one(pool)
        .await?;
        
        // 切换状态
        let new_state = !current;
        sqlx::query(
            "UPDATE recipes SET is_favorite = ?, updated_at = strftime('%s', 'now') WHERE id = ?"
        )
        .bind(new_state)
        .bind(recipe_id)
        .execute(pool)
        .await?;
        
        Ok(new_state)
    }

    /// 获取历史记录
    pub async fn get_history(limit: i32, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let recipes = sqlx::query_as::<_, Recipe>(
            "SELECT DISTINCT r.* FROM recipes r
             JOIN history h ON r.id = h.recipe_id
             ORDER BY h.viewed_at DESC
             LIMIT ?"
        )
        .bind(limit)
        .fetch_all(pool)
        .await?;
        
        Ok(recipes)
    }

    /// 添加到历史记录
    pub async fn add_to_history(recipe_id: &str, pool: &SqlitePool) -> Result<(), AppError> {
        let history_id = uuid::Uuid::new_v4().to_string();
        
        sqlx::query(
            "INSERT INTO history (id, recipe_id, viewed_at) VALUES (?, ?, strftime('%s', 'now'))"
        )
        .bind(history_id)
        .bind(recipe_id)
        .execute(pool)
        .await?;
        
        // 更新配方的查看次数和最后查看时间
        sqlx::query(
            "UPDATE recipes 
             SET view_count = view_count + 1, 
                 last_viewed_at = strftime('%s', 'now')
             WHERE id = ?"
        )
        .bind(recipe_id)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    /// 创建自定义配方
    pub async fn create_custom(
        name_zh: &str,
        category: &str,
        image_url: Option<String>,
        pool: &SqlitePool
    ) -> Result<String, AppError> {
        let id = format!("r-{}", uuid::Uuid::new_v4());
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        sqlx::query(
            r#"
            INSERT INTO recipes (
                id, name_zh, category, image_url, source, difficulty, created_at, updated_at, view_count, is_favorite
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(name_zh)
        .bind(category)
        .bind(&image_url)
        .bind("custom")
        .bind(1)
        .bind(current_time)
        .bind(current_time)
        .bind(0)
        .bind(true)
        .execute(pool)
        .await?;

        Ok(id)
    }

    /// 更新配方图片
    pub async fn update_image(recipe_id: &str, image_url: &str, pool: &SqlitePool) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE recipes SET image_url = ? WHERE id = ?"
        )
        .bind(image_url)
        .bind(recipe_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// 检查配方是否存在
    pub async fn exists(recipe_id: &str, pool: &SqlitePool) -> Result<bool, AppError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM recipes WHERE id = ?"
        )
        .bind(recipe_id)
        .fetch_one(pool)
        .await?;

        Ok(count.0 > 0)
    }

    /// 检查是否为自定义配方
    pub async fn is_custom(recipe_id: &str, pool: &SqlitePool) -> Result<bool, AppError> {
        let source: Option<String> = sqlx::query_scalar(
            "SELECT source FROM recipes WHERE id = ?"
        )
        .bind(recipe_id)
        .fetch_optional(pool)
        .await?;

        Ok(source.map(|s| s == "custom").unwrap_or(false))
    }

    /// 删除配方（仅限自定义配方）
    pub async fn delete(recipe_id: &str, pool: &SqlitePool) -> Result<(), AppError> {
        // 删除配方（级联删除会自动删除关联的原料和步骤）
        sqlx::query("DELETE FROM recipes WHERE id = ?")
            .bind(recipe_id)
            .execute(pool)
            .await?;

        Ok(())
    }
}
