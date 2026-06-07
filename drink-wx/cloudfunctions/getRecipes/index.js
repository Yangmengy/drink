// 云函数: getRecipes
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { category, limit = 50, offset = 0 } = event;

  try {
    const collection = db.collection('recipes');
    let query = collection;

    // 按分类过滤
    if (category) {
      query = query.where({ category });
    }

    // 查询配方列表
    const res = await query
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get();

    return {
      success: true,
      data: res.data
    };
  } catch (error) {
    console.error('getRecipes error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
