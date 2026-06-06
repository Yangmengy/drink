// AI 调酒师推荐引擎
// 基于混合推荐算法：库存过滤 + 多维加权评分

use crate::models::*;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// 推荐引擎
pub struct RecommendationEngine;

impl RecommendationEngine {
    /// 主推荐流程
    pub fn recommend(
        recipes: Vec<RecipeExtended>,
        inventory: Vec<String>,              // 用户拥有的原料 ID 列表
        recipe_ingredients: HashMap<String, Vec<String>>, // recipe_id -> ingredient_ids
        request: &RecommendationRequest,
        user_profile: &UserProfile,
        history: &[RecommendationHistory],
    ) -> Result<Vec<(RecipeExtended, f32, ScoreBreakdown)>, String> {
        // Step 1: 库存硬过滤 (missing_count <= 1)
        let filtered = Self::filter_by_inventory(recipes, &inventory, &recipe_ingredients);
        
        if filtered.is_empty() {
            return Err("没有找到可制作的酒款，请检查您的库存".to_string());
        }

        // Step 2: 多维评分
        let mut scored: Vec<(RecipeExtended, f32, ScoreBreakdown)> = filtered
            .into_iter()
            .map(|(recipe, missing_count)| {
                let breakdown = Self::calculate_score(
                    &recipe,
                    missing_count,
                    request,
                    user_profile,
                    history,
                );
                let total = breakdown.total;
                (recipe, total, breakdown)
            })
            .collect();

        // Step 3: 按分数降序排列
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        Ok(scored)
    }

    /// Step 1: 库存过滤
    fn filter_by_inventory(
        recipes: Vec<RecipeExtended>,
        inventory: &[String],
        recipe_ingredients: &HashMap<String, Vec<String>>,
    ) -> Vec<(RecipeExtended, usize)> {
        recipes
            .into_iter()
            .filter_map(|recipe| {
                if let Some(required_ingredients) = recipe_ingredients.get(&recipe.id) {
                    let missing_count = required_ingredients
                        .iter()
                        .filter(|ing_id| !inventory.contains(ing_id))
                        .count();
                    
                    // 只保留缺失 <= 1 种原料的酒款
                    if missing_count <= 1 {
                        Some((recipe, missing_count))
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect()
    }

    /// Step 2: 多维加权评分
    fn calculate_score(
        recipe: &RecipeExtended,
        missing_count: usize,
        request: &RecommendationRequest,
        user_profile: &UserProfile,
        history: &[RecommendationHistory],
    ) -> ScoreBreakdown {
        let inventory_score = Self::score_inventory(missing_count);
        let mood_score = Self::score_mood(&request.mood_tags, recipe);
        let weather_score = Self::score_weather(&request.weather, request.temperature, recipe);
        let mbti_score = Self::score_mbti(&user_profile.mbti, recipe);
        let zodiac_score = Self::score_zodiac(&user_profile.zodiac, recipe);
        let memory_score = Self::score_memory(&recipe.id, history, recipe);

        let total = inventory_score + mood_score + weather_score + mbti_score + zodiac_score + memory_score;

        ScoreBreakdown {
            inventory: inventory_score,
            mood: mood_score,
            weather: weather_score,
            mbti: mbti_score,
            zodiac: zodiac_score,
            memory: memory_score,
            total,
        }
    }

    /// 库存分 (40%)
    fn score_inventory(missing_count: usize) -> f32 {
        match missing_count {
            0 => 40.0,
            1 => 20.0,
            _ => 0.0,
        }
    }

    /// 心情匹配分 (20%) - Jaccard 相似度
    fn score_mood(user_moods: &[String], recipe: &RecipeExtended) -> f32 {
        if let Some(mood_json) = &recipe.mood {
            if let Ok(recipe_moods) = serde_json::from_str::<Vec<String>>(mood_json) {
                let intersection: usize = user_moods
                    .iter()
                    .filter(|m| recipe_moods.contains(m))
                    .count();
                
                let union = user_moods.len() + recipe_moods.len() - intersection;
                
                if union == 0 {
                    return 10.0; // 默认中性分
                }
                
                return (intersection as f32 / union as f32) * 20.0;
            }
        }
        10.0 // 默认中性分
    }

    /// 天气/季节分 (10%)
    fn score_weather(weather: &Option<String>, temperature: Option<f32>, recipe: &RecipeExtended) -> f32 {
        let mut score:f32 = 0.0;

        if let Some(w) = weather {
            match w.as_str() {
                "sunny" | "hot" => {
                    // 晴热天气偏好夏季、长饮、含冰
                    if let Some(season) = &recipe.season {
                        if season.contains("Summer") {
                            score += 5.0;
                        }
                    }
                    if recipe.glass_type.as_deref() == Some("Highball") {
                        score += 3.0;
                    }
                    if recipe.has_ice == Some(1) {
                        score += 2.0;
                    }
                }
                "rainy" | "cold" | "snowy" => {
                    // 阴冷天气偏好冬季、烈酒、短饮
                    if let Some(season) = &recipe.season {
                        if season.contains("Winter") {
                            score += 5.0;
                        }
                    }
                    if recipe.glass_type.as_deref() == Some("Rocks") || recipe.glass_type.as_deref() == Some("Coupe") {
                        score += 3.0;
                    }
                    if recipe.flavor_strong.unwrap_or(3) >= 4 {
                        score += 2.0;
                    }
                }
                "cloudy" => {
                    score += 5.0; // 中性天气，给个基础分
                }
                _ => {}
            }
        }

        // 温度调整
        if let Some(temp) = temperature {
            if temp > 28.0 && recipe.has_ice == Some(1) {
                score += 1.0;
            } else if temp < 10.0 && recipe.flavor_strong.unwrap_or(3) >= 4 {
                score += 1.0;
            }
        }

        score.min(10.0)
    }

    /// MBTI 风味距离分 (15%)
    fn score_mbti(mbti: &Option<String>, recipe: &RecipeExtended) -> f32 {
        if let Some(mbti_str) = mbti {
            let ideal_flavor = Self::mbti_to_flavor(mbti_str);
            let actual_flavor = [
                recipe.flavor_sweet.unwrap_or(3) as f32,
                recipe.flavor_sour.unwrap_or(3) as f32,
                recipe.flavor_bitter.unwrap_or(3) as f32,
                recipe.flavor_strong.unwrap_or(3) as f32,
            ];

            // 计算欧氏距离
            let distance: f32 = ideal_flavor
                .iter()
                .zip(actual_flavor.iter())
                .map(|(a, b)| (a - b).powi(2))
                .sum::<f32>()
                .sqrt();

            // 距离越小分数越高
            let max_distance = 8.0; // 理论最大距离约为 sqrt(4*4^2) = 8
            return ((max_distance - distance) / max_distance * 15.0).max(0.0);
        }
        7.5 // 默认中性分
    }

    /// MBTI 到理想风味向量的映射
    fn mbti_to_flavor(mbti: &str) -> [f32; 4] {
        let mut flavor = [3.0; 4]; // [sweet, sour, bitter, strong]

        let chars: Vec<char> = mbti.chars().collect();
        if chars.len() != 4 {
            return flavor;
        }

        // E/I: 外向高甜酸，内向高苦烈
        if chars[0] == 'E' {
            flavor[0] += 1.0; // sweet
            flavor[1] += 1.0; // sour
        } else {
            flavor[2] += 1.0; // bitter
            flavor[3] += 1.0; // strong
        }

        // S/N: 感觉偏传统，直觉偏创新 (对风味影响较小)
        
        // T/F: 思考偏苦烈，情感偏甜酸
        if chars[2] == 'T' {
            flavor[2] += 0.5;
            flavor[3] += 0.5;
        } else {
            flavor[0] += 0.5;
            flavor[1] += 0.5;
        }

        // J/P: 判断偏平衡，感知偏极端
        if chars[3] == 'P' {
            // 感知型偏好更极端的口味，增加差异
            for i in 0..4 {
                if flavor[i] > 3.0 {
                    flavor[i] += 0.3;
                }
            }
        }

        flavor
    }

    /// 星座契合分 (15%)
    fn score_zodiac(zodiac: &Option<String>, recipe: &RecipeExtended) -> f32 {
        if let Some(zodiac_str) = zodiac {
            let base_spirit = recipe.base_spirit.as_deref().unwrap_or("");
            
            let score = match zodiac_str.as_str() {
                // 火象星座：白羊/狮子/射手 -> 热带/特基拉/热情
                "Aries" | "Leo" | "Sagittarius" => {
                    if base_spirit == "Tequila" { 15.0 }
                    else if base_spirit == "Rum" { 12.0 }
                    else if recipe.flavor_strong.unwrap_or(3) >= 4 { 10.0 }
                    else { 7.5 }
                }
                // 水象星座：巨蟹/天蝎/双鱼 -> 柔和/朗姆/甜美
                "Cancer" | "Scorpio" | "Pisces" => {
                    if base_spirit == "Rum" { 15.0 }
                    else if recipe.flavor_sweet.unwrap_or(3) >= 4 { 12.0 }
                    else if base_spirit == "Vodka" { 10.0 }
                    else { 7.5 }
                }
                // 土象星座：金牛/处女/摩羯 -> 威士忌/草本/平衡
                "Taurus" | "Virgo" | "Capricorn" => {
                    if base_spirit == "Whiskey" { 15.0 }
                    else if recipe.flavor_bitter.unwrap_or(3) >= 3 { 12.0 }
                    else if base_spirit == "Brandy" { 10.0 }
                    else { 7.5 }
                }
                // 风象星座：双子/天秤/水瓶 -> 金酒/气泡/清爽
                "Gemini" | "Libra" | "Aquarius" => {
                    if base_spirit == "Gin" { 15.0 }
                    else if recipe.has_sparkling == Some(1) { 12.0 }
                    else if recipe.flavor_sour.unwrap_or(3) >= 4 { 10.0 }
                    else { 7.5 }
                }
                _ => 7.5,
            };

            return score;
        }
        7.5 // 默认中性分
    }

    /// 历史偏好分 (10% - 记忆系统)
    fn score_memory(recipe_id: &str, history: &[RecommendationHistory], recipe: &RecipeExtended) -> f32 {
        if history.is_empty() {
            return 5.0; // 新用户，默认中性分
        }

        // 统计用户喜欢的酒款
        let liked_recipes: Vec<_> = history
            .iter()
            .filter(|h| h.user_feedback == Some(1))
            .collect();

        if liked_recipes.is_empty() {
            return 5.0;
        }

        // 避免重复推荐最近刚推荐过的酒款
        let recent_recipes: Vec<_> = history
            .iter()
            .rev()
            .take(5)
            .filter(|h| h.recipe_id == recipe_id)
            .collect();

        if !recent_recipes.is_empty() {
            // 最近推荐过，降低分数
            return 2.0;
        }

        // 计算与喜欢酒款的相似度
        let mut similarity_score = 0.0;
        let mut count = 0;

        for liked in &liked_recipes {
            // 基酒相同 +3 分
            if let Some(base) = &recipe.base_spirit {
                if liked.recipe_id.contains(base) {
                    similarity_score += 3.0;
                    count += 1;
                }
            }

            // 心情标签重叠 +2 分
            if let Ok(liked_moods) = serde_json::from_str::<Vec<String>>(&liked.mood_tags) {
                if let Some(recipe_mood) = &recipe.mood {
                    if let Ok(recipe_moods) = serde_json::from_str::<Vec<String>>(recipe_mood) {
                        let overlap = liked_moods.iter().filter(|m| recipe_moods.contains(m)).count();
                        if overlap > 0 {
                            similarity_score += 2.0;
                            count += 1;
                        }
                    }
                }
            }
        }

        if count > 0 {
            (similarity_score / count as f32).min(10.0)
        } else {
            5.0
        }
    }

    /// 生成记忆上下文
    pub fn generate_memory_context(history: &[RecommendationHistory]) -> Option<MemoryContext> {
        if history.is_empty() {
            return None;
        }

        // 统计总推荐次数
        let total_recommendations = history.len() as i32;

        // 最近喜欢的酒款
        let recent_favorites: Vec<String> = history
            .iter()
            .rev()
            .filter(|h| h.user_feedback == Some(1))
            .take(3)
            .map(|h| h.recipe_id.clone())
            .collect();

        // 生成偏好摘要
        let preference_summary = Self::generate_preference_summary(history);

        Some(MemoryContext {
            total_recommendations,
            recent_favorites,
            preference_summary,
        })
    }

    /// 生成偏好摘要
    fn generate_preference_summary(history: &[RecommendationHistory]) -> String {
        let liked_history: Vec<_> = history
            .iter()
            .filter(|h| h.user_feedback == Some(1))
            .collect();

        if liked_history.is_empty() {
            return "首次体验 AI 调酒师".to_string();
        }

        // 分析最常出现的心情标签
        let mut mood_counts: HashMap<String, usize> = HashMap::new();
        for h in &liked_history {
            if let Ok(moods) = serde_json::from_str::<Vec<String>>(&h.mood_tags) {
                for mood in moods {
                    *mood_counts.entry(mood).or_insert(0) += 1;
                }
            }
        }

        let top_mood = mood_counts
            .iter()
            .max_by_key(|(_, count)| *count)
            .map(|(mood, _)| mood.clone())
            .unwrap_or_else(|| "放松".to_string());

        format!(
            "您已获得 {} 次推荐，似乎偏好「{}」时刻的酒款",
            liked_history.len(),
            top_mood
        )
    }

    /// 生成推介词 (降级方案 - 模板生成)
    pub fn generate_reason_template(
        recipe: &RecipeExtended,
        request: &RecommendationRequest,
        memory_context: &Option<MemoryContext>,
    ) -> String {
        let mut reason = String::new();

        // 根据心情生成开头
        if let Some(first_mood) = request.mood_tags.first() {
            reason.push_str(&format!("感觉您今天{}", Self::mood_to_text(first_mood)));
        } else {
            reason.push_str("今天");
        }

        // 推荐酒款
        reason.push_str(&format!("，为您特调一杯「{}」", recipe.name_zh));

        // 描述风味
        let flavor_desc = Self::describe_flavor(recipe);
        reason.push_str(&format!("。{}", flavor_desc));

        // 加入记忆上下文
        if let Some(memory) = memory_context {
            if !memory.recent_favorites.is_empty() {
                reason.push_str(" 这款酒的风格与您之前喜欢的相似，相信您会喜欢。");
            }
        }

        // 鼓励语
        reason.push_str(" 愿这一杯美酒，陪伴您度过美好时光 🍹");

        reason
    }

    /// 心情标签转文字
    fn mood_to_text(mood: &str) -> &str {
        match mood {
            "happy" => "心情愉悦",
            "sad" => "有些低落",
            "tired" => "感到疲惫",
            "stressed" => "压力山大",
            "relaxed" => "想要放松",
            "excited" => "充满活力",
            "romantic" => "浪漫氛围",
            "celebrate" => "值得庆祝",
            "lonely" => "有些孤单",
            "anxious" => "有些焦虑",
            "bored" => "有点无聊",
            "creative" => "灵感迸发",
            _ => "心情不错",
        }
    }

    /// 描述风味
    fn describe_flavor(recipe: &RecipeExtended) -> String {
        let sweet = recipe.flavor_sweet.unwrap_or(3);
        let sour = recipe.flavor_sour.unwrap_or(3);
        let bitter = recipe.flavor_bitter.unwrap_or(3);
        let strong = recipe.flavor_strong.unwrap_or(3);

        let mut descriptors = Vec::new();

        if sweet >= 4 {
            descriptors.push("甜美");
        }
        if sour >= 4 {
            descriptors.push("清爽酸味");
        }
        if bitter >= 4 {
            descriptors.push("微苦回甘");
        }
        if strong >= 4 {
            descriptors.push("浓烈醇厚");
        }

        if descriptors.is_empty() {
            "口感平衡，层次丰富".to_string()
        } else {
            format!("这是一款{}的经典调酒", descriptors.join("、"))
        }
    }
}
