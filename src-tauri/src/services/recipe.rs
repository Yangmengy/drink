use sqlx::SqlitePool;
use crate::models::{Recipe, RecipeDetail, RecipeFilter, SearchArgs};
use crate::error::AppError;
use crate::repositories::recipe::RecipeRepository;

pub struct RecipeService;

impl RecipeService {
    /// 搜索配方
    pub async fn search(args: SearchArgs, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        // 业务规则：限制搜索结果数量
        let args_with_limit = SearchArgs {
            limit: Some(args.limit.unwrap_or(50).min(100)), // 最多100条
            ..args
        };
        
        RecipeRepository::search(&args_with_limit, pool).await
    }

    /// 根据 ID 获取配方详情
    pub async fn get_by_id(id: String, pool: &SqlitePool) -> Result<Option<RecipeDetail>, AppError> {
        // 业务规则：校验ID格式
        if id.is_empty() {
            return Err(AppError::Validation("Recipe ID cannot be empty".into()));
        }
        
        RecipeRepository::get_by_id(&id, pool).await
    }

    /// 获取配方列表
    pub async fn get_list(filter: Option<RecipeFilter>, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        RecipeRepository::get_list(filter, pool).await
    }

    /// 获取推荐配方
    pub async fn get_recommended(limit: Option<i32>, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let limit = limit.unwrap_or(10).min(50); // 业务规则：最多推荐50个
        RecipeRepository::get_recommended(limit, pool).await
    }

    /// 获取收藏的配方
    pub async fn get_favorites(pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        RecipeRepository::get_favorites(pool).await
    }

    /// 切换收藏状态
    pub async fn toggle_favorite(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        // 业务规则：校验配方是否存在
        if !RecipeRepository::exists(&recipe_id, pool).await? {
            return Err(AppError::NotFound(format!("Recipe {} not found", recipe_id)));
        }
        
        RecipeRepository::toggle_favorite(&recipe_id, pool).await
    }

    /// 获取历史记录
    pub async fn get_history(limit: Option<i32>, pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let limit = limit.unwrap_or(20).min(100); // 业务规则：最多100条历史
        RecipeRepository::get_history(limit, pool).await
    }

    /// 添加到历史记录
    pub async fn add_to_history(recipe_id: String, pool: &SqlitePool) -> Result<(), AppError> {
        // 业务规则：校验配方是否存在
        if !RecipeRepository::exists(&recipe_id, pool).await? {
            return Err(AppError::NotFound(format!("Recipe {} not found", recipe_id)));
        }
        
        RecipeRepository::add_to_history(&recipe_id, pool).await
    }

    /// 创建自定义配方
    pub async fn create_custom(
        name_zh: String,
        category: String,
        image_url: Option<String>,
        details: Option<crate::models::CustomRecipeDetails>,
        pool: &SqlitePool
    ) -> Result<String, AppError> {
        // 业务规则：校验参数
        if name_zh.trim().is_empty() {
            return Err(AppError::Validation("Recipe name cannot be empty".into()));
        }
        
        if category.trim().is_empty() {
            return Err(AppError::Validation("Category cannot be empty".into()));
        }
        
        RecipeRepository::create_custom(&name_zh, &category, image_url, details, pool).await
    }

    /// 更新配方图片
    pub async fn update_image(
        recipe_id: String,
        image_url: String,
        pool: &SqlitePool
    ) -> Result<(), AppError> {
        // 业务规则：校验配方是否存在
        if !RecipeRepository::exists(&recipe_id, pool).await? {
            return Err(AppError::NotFound(format!("Recipe {} not found", recipe_id)));
        }
        
        // 业务规则：校验图片URL
        if image_url.trim().is_empty() {
            return Err(AppError::Validation("Image URL cannot be empty".into()));
        }
        
        RecipeRepository::update_image(&recipe_id, &image_url, pool).await
    }

    /// 删除配方（仅限自定义配方）
    pub async fn delete_recipe(
        recipe_id: String,
        pool: &SqlitePool
    ) -> Result<(), AppError> {
        // 业务规则：校验配方是否存在
        if !RecipeRepository::exists(&recipe_id, pool).await? {
            return Err(AppError::NotFound(format!("Recipe {} not found", recipe_id)));
        }
        
        // 业务规则：只能删除自定义配方
        if !RecipeRepository::is_custom(&recipe_id, pool).await? {
            return Err(AppError::Validation(
                "Cannot delete built-in recipes. Only custom recipes can be deleted.".into()
            ));
        }
        
        RecipeRepository::delete(&recipe_id, pool).await
    }
}
