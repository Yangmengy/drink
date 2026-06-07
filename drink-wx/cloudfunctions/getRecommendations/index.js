// 云函数: getRecommendations
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { inventoryIds = [] } = event;

  try {
    if (inventoryIds.length === 0) {
      return {
        success: true,
        data: { canMake: [], almostCanMake: [] }
      };
    }

    // 获取所有配方及其原料
    const recipesRes = await db.collection('recipes')
      .limit(1000)
      .get();

    const recipes = recipesRes.data;

    const canMake = [];
    const almostCanMake = [];

    for (const recipe of recipes) {
      // 获取该配方的所有原料
      const ingredientsRes = await db.collection('recipe_ingredients')
        .where({
          recipe_id: recipe._id,
          is_optional: false // 只考虑必需原料
        })
        .get();

      const requiredIngredients = ingredientsRes.data;
      const requiredIds = requiredIngredients.map(ing => ing.ingredient_id);

      // 计算缺少的原料
      const missing = requiredIds.filter(id => !inventoryIds.includes(id));

      if (missing.length === 0) {
        // 可以制作
        canMake.push(recipe);
      } else if (missing.length <= 2) {
        // 差一点就能做（缺 1-2 种原料）
        almostCanMake.push({
          ...recipe,
          missing_count: missing.length,
          missing_ingredients: missing
        });
      }
    }

    return {
      success: true,
      data: {
        canMake: canMake.slice(0, 20),
        almostCanMake: almostCanMake.slice(0, 10)
      }
    };
  } catch (error) {
    console.error('getRecommendations error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
