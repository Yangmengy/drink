// pages/search/search.js
Page({
  data: {
    searchValue: '',
    searching: false,
    results: [],
    history: [],
    hotKeywords: ['莫吉托', 'Mojito', '血腥玛丽', '玛格丽特', '长岛冰茶']
  },

  onLoad() {
    this.loadSearchHistory();
  },

  /**
   * 加载搜索历史
   */
  loadSearchHistory() {
    const history = wx.getStorageSync('search_history') || [];
    this.setData({ history: history.slice(0, 10) });
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    this.setData({ searchValue: e.detail.value });
  },

  /**
   * 执行搜索
   */
  async performSearch(keyword) {
    if (!keyword || !keyword.trim()) {
      return;
    }

    this.setData({ searching: true, searchValue: keyword });

    try {
      const results = await this.searchRecipes(keyword);
      this.setData({
        results,
        searching: false
      });

      // 保存搜索历史
      this.saveSearchHistory(keyword);
    } catch (error) {
      console.error('搜索失败:', error);
      this.setData({ searching: false });
    }
  },

  /**
   * 搜索配方
   */
  async searchRecipes(keyword) {
    const recipes = wx.getStorageSync('recipes') || [];
    const lowerKeyword = keyword.toLowerCase();

    return recipes.filter(recipe =>
      recipe.name_zh.includes(keyword) ||
      (recipe.name_en && recipe.name_en.toLowerCase().includes(lowerKeyword)) ||
      (recipe.description && recipe.description.includes(keyword)) ||
      (recipe.tags && recipe.tags.includes(keyword))
    );
  },

  /**
   * 保存搜索历史
   */
  saveSearchHistory(keyword) {
    let history = wx.getStorageSync('search_history') || [];
    
    // 移除重复
    history = history.filter(item => item !== keyword);
    
    // 添加到开头
    history.unshift(keyword);
    
    // 保留最近 20 条
    history = history.slice(0, 20);
    
    wx.setStorageSync('search_history', history);
    this.setData({ history: history.slice(0, 10) });
  },

  /**
   * 点击搜索按钮
   */
  onSearchSubmit() {
    this.performSearch(this.data.searchValue);
  },

  /**
   * 点击历史记录
   */
  onHistoryClick(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.performSearch(keyword);
  },

  /**
   * 点击热门关键词
   */
  onHotKeywordClick(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.performSearch(keyword);
  },

  /**
   * 清空搜索历史
   */
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('search_history');
          this.setData({ history: [] });
        }
      }
    });
  },

  /**
   * 查看配方详情
   */
  goToRecipe(e) {
    const recipeId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/recipe-detail/recipe-detail?id=${recipeId}`
    });
  }
});
