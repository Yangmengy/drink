// 云函数: getRecipeDetail
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { recipeId } = event;

  try {
    // 获取配方基本信息
    const recipeRes = await db.collection('recipes')
      .doc(recipeId)
      .get();

    if (!recipeRes.data) {
      return {
        success: false,
        error: 'Recipe not found'
      };
    }

    const recipe = recipeRes.data;

    // 获取原料信息
    const ingredientsRes = await db.collection('recipe_ingredients')
      .where({ recipe_id: recipeId })
      .get();

    // 获取制作步骤
    const stepsRes = await db.collection('recipe_steps')
      .where({ recipe_id: recipeId })
      .orderBy('step_number', 'asc')
      .get();

    // 组合数据
    recipe.ingredients = ingredientsRes.data || [];
    recipe.steps = stepsRes.data || [];

    return {
      success: true,
      data: recipe
    };
  } catch (error) {
    console.error('getRecipeDetail error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
