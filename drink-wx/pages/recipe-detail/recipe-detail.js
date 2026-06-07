// pages/recipe-detail/recipe-detail.js - 配方详情页（使用真实数据）
import { RECIPES } from '../../utils/data.js';

Page({
  data: {
    loading: false,
    recipe: null,
    isFavorite: false,
    recipeId: null
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ recipeId: id });
      this.loadRecipe();
    }
  },

  /**
   * 加载配方详情
   */
  loadRecipe() {
    const { recipeId } = this.data;
    
    // 从真实数据获取配方
    const recipe = RECIPES.find(r => r.id === recipeId);
    
    if (recipe) {
      // 检查是否已收藏
      const favorites = wx.getStorageSync('favorites') || [];
      const isFavorite = favorites.includes(recipeId);
      
      this.setData({
        recipe,
        isFavorite,
        loading: false
      });
      
      // 添加到浏览历史
      this.addToHistory(recipeId);
    } else {
      wx.showToast({
        title: '配方不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 添加到浏览历史
   */
  addToHistory(recipeId) {
    let history = wx.getStorageSync('history') || [];
    const timestamp = Date.now();
    
    // 移除旧记录
    history = history.filter(item => item.recipe_id !== recipeId);
    
    // 添加新记录
    history.unshift({ recipe_id: recipeId, viewed_at: timestamp });
    
    // 保留最近 50 条
    history = history.slice(0, 50);
    
    wx.setStorageSync('history', history);
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  },

  /**
   * 切换收藏
   */
  toggleFavorite() {
    const { recipeId, isFavorite } = this.data;
    let favorites = wx.getStorageSync('favorites') || [];
    
    if (isFavorite) {
      favorites = favorites.filter(id => id !== recipeId);
      wx.showToast({ title: '已取消收藏', icon: 'none', duration: 1000 });
    } else {
      favorites.push(recipeId);
      wx.showToast({ title: '已收藏', icon: 'success', duration: 1000 });
    }
    
    wx.setStorageSync('favorites', favorites);
    this.setData({ isFavorite: !isFavorite });
  },

  /**
   * 加入清单
   */
  addToTodo() {
    const { recipeId } = this.data;
    let todos = wx.getStorageSync('todos') || [];
    
    if (todos.includes(recipeId)) {
      wx.showToast({ title: '已在清单中', icon: 'none' });
    } else {
      todos.push(recipeId);
      wx.setStorageSync('todos', todos);
      wx.showToast({ title: '已加入清单', icon: 'success' });
    }
  },

  /**
   * 开始调制
   */
  startMaking() {
    const { recipe } = this.data;
    if (!recipe) return;
    
    // 检查是否有所有原料
    const inventory = wx.getStorageSync('inventory') || [];
    const ownedIds = new Set(inventory.map(item => item.ingredient_id || item.id));
    const requiredIds = recipe.ingredients.map(ing => ing.id);
    const missingIds = requiredIds.filter(id => !ownedIds.has(id));
    
    if (missingIds.length > 0) {
      wx.showModal({
        title: '缺少原料',
        content: `还差 ${missingIds.length} 种原料，是否查看？`,
        confirmText: '查看',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/mybar/mybar' });
          }
        }
      });
      return;
    }
    
    // 可以调制，跳转到记录页添加记录
    wx.showModal({
      title: '开始调制',
      content: '是否记录这次调制？',
      confirmText: '记录',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/record/record' });
        }
      }
    });
  }
});
