// pages/mybar/mybar.js - 1:1 复原原版酒柜页面（使用真实数据）
import { INGREDIENTS, INGREDIENT_CATEGORIES } from '../../utils/data.js';

Page({
  data: {
    loading: false,
    searchQuery: '',
    selectedCategory: 'all',
    ownedIds: [],
    allIngredients: INGREDIENTS,
    categories: INGREDIENT_CATEGORIES
  },

  onLoad() {
    this.loadInventory();
  },

  onShow() {
    this.loadInventory();
  },

  /**
   * 加载库存
   */
  loadInventory() {
    try {
      const inventory = wx.getStorageSync('inventory') || [];
      const ownedIds = inventory.map(item => item.ingredient_id || item.id);
      
      this.setData({
        ownedIds: ownedIds,
        loading: false
      });
    } catch (error) {
      console.error('加载库存失败:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 分类切换
   */
  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ selectedCategory: category });
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value });
  },

  /**
   * 切换拥有状态
   */
  toggleOwned(e) {
    const ingredientId = e.currentTarget.dataset.id;
    const ownedIds = [...this.data.ownedIds];
    const index = ownedIds.indexOf(ingredientId);
    
    if (index >= 0) {
      ownedIds.splice(index, 1);
      wx.showToast({ title: '已移除', icon: 'success', duration: 1000 });
    } else {
      ownedIds.push(ingredientId);
      wx.showToast({ title: '已添加', icon: 'success', duration: 1000 });
    }
    
    // 保存到本地存储
    const inventory = ownedIds.map(id => ({ ingredient_id: id }));
    wx.setStorageSync('inventory', inventory);
    
    this.setData({ ownedIds });
  }
});
