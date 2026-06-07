// pages/record/record.js - 饮酒记录页
Page({
  data: {
    currentMonth: '',
    selectedDate: '',
    monthlyCount: 0,
    records: [],
    loading: false
  },

  onLoad() {
    this.initializeDate();
    this.loadRecords();
  },

  /**
   * 初始化日期
   */
  initializeDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    this.setData({
      currentMonth: `${year}-${month}`,
      selectedDate: `${year}-${month}-${day}`
    });
  },

  /**
   * 加载记录
   */
  loadRecords() {
    const records = wx.getStorageSync('drink_records') || [];
    const { currentMonth, selectedDate } = this.data;
    
    // 过滤当月记录
    const monthlyRecords = records.filter(r => r.date.startsWith(currentMonth));
    
    // 过滤当日记录
    const selectedRecords = records.filter(r => r.date === selectedDate);
    
    this.setData({
      records: selectedRecords,
      monthlyCount: monthlyRecords.length,
      loading: false
    });
  },

  /**
   * 选择日期
   */
  onDateChange(e) {
    const selectedDate = e.detail.value;
    this.setData({ selectedDate }, () => {
      this.loadRecords();
    });
  },

  /**
   * 添加记录
   */
  addRecord() {
    wx.showModal({
      title: '添加记录',
      content: '请选择一款鸡尾酒',
      showCancel: true,
      success: (res) => {
        if (res.confirm) {
          // 跳转到发现页选择配方
          wx.switchTab({
            url: '/pages/discover/discover'
          });
        }
      }
    });
  },

  /**
   * 查看记录详情
   */
  viewRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 删除记录
   */
  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          let records = wx.getStorageSync('drink_records') || [];
          records = records.filter(r => r.id !== id);
          wx.setStorageSync('drink_records', records);
          
          this.loadRecords();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});