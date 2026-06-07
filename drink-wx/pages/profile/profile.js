// pages/profile/profile.js - 1:1 复原原版我的页面
Page({
  data: {
    userInfo: {
      username: '喵星人',
      bio: '点击添加个性签名',
      avatar: null
    },
    stats: {
      favoriteCount: 12,
      historyCount: 45,
      ratingCount: 8
    }
  },

  onLoad() {
    this.loadUserInfo();
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {
      username: '喵星人',
      bio: '点击添加个性签名',
      avatar: null
    };
    this.setData({ userInfo });
  },

  /**
   * 加载统计信息
   */
  loadStats() {
    const favorites = wx.getStorageSync('favorites') || [];
    const history = wx.getStorageSync('history') || [];
    const ratings = wx.getStorageSync('ratings') || [];

    this.setData({
      stats: {
        favoriteCount: favorites.length || 12,
        historyCount: history.length || 45,
        ratingCount: ratings.length || 8
      }
    });
  },

  /**
   * 编辑用户信息
   */
  editProfile() {
    wx.showModal({
      title: '编辑资料',
      content: '此功能开发中...',
      showCancel: false
    });
  },

  /**
   * 我的喜欢
   */
  goToFavorites() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 浏览历史
   */
  goToHistory() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 我的评分
   */
  goToRatings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 背景设置
   */
  goToBackgroundSettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 偏好设置
   */
  goToSettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 分享
   */
  share() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 帮助与反馈
   */
  goToHelp() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  }
});
