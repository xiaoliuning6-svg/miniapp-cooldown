// pages/me —— 省钱账本 + 我的决策单
const { call } = require('../../utils/api.js');
const { yuan } = require('../../utils/format.js');
const { DEMO_MODE } = require('../../utils/config.js');

Page({
  data: {
    profile: null, list: [], loading: true,
    savedText: '0', listLoading: false, hasMore: false, page: 1,
    demoMode: DEMO_MODE
  },

  onShow() { this.load(); },

  onPullDownRefresh() { this.load(() => wx.stopPullDownRefresh()); },

  async load(done) {
    try {
      const [profile, listData] = await Promise.all([
        call('userProfile', {}, { silent: true }),
        call('decisionList', { scope: 'mine', page: 1, size: 20 }, { silent: true })
      ]);
      this.setData({
        profile,
        savedText: yuan(profile.totalSaved),
        list: listData.list.map(x => ({ ...x, priceText: yuan(x.price) })),
        page: 2,
        hasMore: listData.hasMore,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none' });
    } finally {
      if (typeof done === 'function') done();
    }
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.listLoading) return;
    this.setData({ listLoading: true });
    try {
      const data = await call('decisionList',
        { scope: 'mine', page: this.data.page, size: 20 }, { silent: true });
      this.setData({
        list: this.data.list.concat(data.list.map(x => ({ ...x, priceText: yuan(x.price) }))),
        page: this.data.page + 1,
        hasMore: data.hasMore,
        listLoading: false
      });
    } catch (e) {
      this.setData({ listLoading: false });
    }
  },

  onReachBottom() { this.loadMore(); },

  // 演示模式专用：把所有冷静期置为已结束，立刻验收结算逻辑
  async onDemoExpire() {
    try {
      await call('demoExpireAll');
      wx.showToast({ title: '已全部到期，去决策单结算试试', icon: 'none', duration: 2500 });
      this.load();
    } catch (e) { /* api.js 已统一提示 */ }
  },

  // 演示模式专用：清空测试数据，恢复初始演示状态（不可撤销，故二次确认）
  onDemoReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '将删除你测试时提交的所有决策单、投票和举报，恢复到初始演示数据。此操作不可撤销。',
      confirmText: '确认重置',
      confirmColor: '#e64340',
      success: (res) => {
        if (!res.confirm) return;
        call('demoReset').then(() => {
          wx.showToast({ title: '已恢复初始演示数据', icon: 'success' });
          this.load();
        }).catch(() => { /* api.js 已统一提示 */ });
      }
    });
  },

  onCardTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.detail.id}` });
  },

  onGoCreate() { wx.switchTab({ url: '/pages/create/create' }); },

  onShareAppMessage() {
    return { title: '我已经省下一笔了，你也来冷静一下', path: '/pages/index/index' };
  }
});
