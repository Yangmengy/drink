// pages/discover/discover.js - 发现页逻辑（使用真实数据）
import { RECIPES, CATEGORIES } from '../../utils/data.js';

Page({
  data: {
    loading: false,
    selectedCategory: null,
    searchQuery: '',
    canMakeCount: 0,
    
    // 使用真实配方数据
    recipes: [],
    featuredRecipes: [],
    categories: CATEGORIES
  },

  onLoad() {
    this.loadRecipes();
  },

  onShow() {
    this.calculateCanMake();
  },

  /**
   * 加载配方数据
   */
  loadRecipes() {
    // 从真实数据加载
    const recipes = RECIPES.map(recipe => ({
      ...recipe,
      is_favorite: this.checkIsFavorite(recipe.id)
    }));
    
    this.setData({
      recipes: recipes,
      featuredRecipes: recipes.slice(0, 6),
      loading: false
    });
  },

  /**
   * 检查是否已收藏
   */
  checkIsFavorite(recipeId) {
    const favorites = wx.getStorageSync('favorites') || [];
    return favorites.includes(recipeId);
  },

  /**
   * 计算可调制数量
   */
  calculateCanMake() {
    const inventory = wx.getStorageSync('inventory') || [];
    const ownedIngredientIds = new Set(inventory.map(item => item.ingredient_id || item.id));
    
    let canMakeCount = 0;
    RECIPES.forEach(recipe => {
      const requiredIds = recipe.ingredients.map(ing => ing.id);
      const hasAll = requiredIds.every(id => ownedIngredientIds.has(id));
      if (hasAll) canMakeCount++;
    });
    
    this.setData({ canMakeCount });
  },

  /**
   * 分类筛选
   */
  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    const selectedCategory = this.data.selectedCategory === category ? null : category;
    
    let filteredRecipes = RECIPES;
    if (selectedCategory && selectedCategory !== 'all') {
      filteredRecipes = RECIPES.filter(r => r.category === selectedCategory);
    }
    
    this.setData({
      selectedCategory,
      recipes: filteredRecipes.map(recipe => ({
        ...recipe,
        is_favorite: this.checkIsFavorite(recipe.id)
      }))
    });
  },

  /**
   * 跳转到配方详情
   */
  goToRecipe(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/recipe-detail/recipe-detail?id=${id}`
    });
  },

  /**
   * 跳转到搜索
   */
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  /**
   * 显示今日灵感
   */
  showInspiration() {
    const inventory = wx.getStorageSync('inventory') || [];
    const ownedIngredientIds = new Set(inventory.map(item => item.ingredient_id || item.id));
    
    const canMake = RECIPES.filter(recipe => {
      const requiredIds = recipe.ingredients.map(ing => ing.id);
      return requiredIds.every(id => ownedIngredientIds.has(id));
    });
    
    if (canMake.length === 0) {
      wx.showModal({
        title: '今日灵感',
        content: '你的酒柜还没有原料呢！先去添加一些原料吧～',
        confirmText: '去添加',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/mybar/mybar' });
          }
        }
      });
    } else {
      wx.showModal({
        title: '今日灵感',
        content: `发现 ${canMake.length} 款可调制的鸡尾酒！\n\n${canMake.slice(0, 3).map(r => r.name_zh).join('\n')}`,
        showCancel: false
      });
    }
  },

  /**
   * 跳转到 AI 调酒师
   */
  goToAI() {
    wx.showToast({ title: 'AI 调酒师功能开发中', icon: 'none' });
  },

  /**
   * 切换收藏
   */
  toggleFavorite(e) {
    const { id } = e.currentTarget.dataset;
    let favorites = wx.getStorageSync('favorites') || [];
    
    if (favorites.includes(id)) {
      favorites = favorites.filter(fid => fid !== id);
      wx.showToast({ title: '已取消收藏', icon: 'none', duration: 1000 });
    } else {
      favorites.push(id);
      wx.showToast({ title: '已收藏', icon: 'success', duration: 1000 });
    }
    
    wx.setStorageSync('favorites', favorites);
    this.loadRecipes();
  }
});
