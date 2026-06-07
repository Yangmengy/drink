// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
        env: 'prod-xxx' // 替换为你的云开发环境 ID
      });
    }

    // 初始化本地缓存
    this.initLocalCache();
    
    // 检查更新
    this.checkUpdate();
  },

  onShow() {
    // 检查网络状态
    this.checkNetworkStatus();
  },

  globalData: {
    userInfo: null,
    recipes: [],
    ingredients: [],
    inventory: [],
    isOnline: true
  },

  /**
   * 初始化本地缓存
   */
  initLocalCache() {
    try {
      const recipes = wx.getStorageSync('recipes');
      const ingredients = wx.getStorageSync('ingredients');
      const inventory = wx.getStorageSync('inventory');
      
      if (recipes) this.globalData.recipes = recipes;
      if (ingredients) this.globalData.ingredients = ingredients;
      if (inventory) this.globalData.inventory = inventory;
      
      console.log('本地缓存初始化完成');
    } catch (e) {
      console.error('初始化本地缓存失败:', e);
    }
  },

  /**
   * 检查网络状态
   */
  checkNetworkStatus() {
    wx.getNetworkType({
      success: (res) => {
        this.globalData.isOnline = res.networkType !== 'none';
        if (!this.globalData.isOnline) {
          wx.showToast({
            title: '离线模式',
            icon: 'none',
            duration: 2000
          });
        }
      }
    });
  },

  /**
   * 检查小程序更新
   */
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      
      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          console.log('发现新版本');
        }
      });

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          }
        });
      });

      updateManager.onUpdateFailed(() => {
        console.error('新版本下载失败');
      });
    }
  }
});
