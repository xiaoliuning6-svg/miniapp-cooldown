// pages/index —— 审批广场
const { call } = require('../../utils/api.js');
const { yuan } = require('../../utils/format.js');

Page({
  data: {
    list: [], page: 1, hasMore: true, loading: false, refreshing: false
  },

  onShow() {
    // 每次显示都刷新第一页（onShow 是唯一加载入口，生命周期上 onLoad 后必跟 onShow）：
    // 从 create 提交返回、从 detail 投票返回都会触发 onShow。
    // 之前用 _dirty 标记只在详情页返回时刷新，漏了「提交新单后 switchTab 回广场」这条路径，
    // 导致新提交的单不显示（我的页能看到、广场看不到，数据不一致）。第一页仅 10 条，开销可忽略。
    this.loadList(true);
  },
  onPullDownRefresh() { this.loadList(true); },
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadList(false);
  },

  async loadList(refresh) {
    if (this.data.loading) { if (refresh) wx.stopPullDownRefresh(); return; }
    this.setData({ loading: true });
    const page = refresh ? 1 : this.data.page;
    try {
      const data = await call('decisionList', { scope: 'plaza', page, size: 10 }, { silent: true });
      const formatted = data.list.map(x => ({ ...x, priceText: yuan(x.price) }));
      this.setData({
        list: refresh ? formatted : this.data.list.concat(formatted),
        page: page + 1,
        hasMore: data.hasMore,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    } finally {
      if (refresh) wx.stopPullDownRefresh();
    }
  },

  onCardTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.detail.id}` });
  },

  onGoCreate() { wx.switchTab({ url: '/pages/create/create' }); },

  onShareAppMessage() {
    return { title: '帮我三个小时后再决定买不买', path: '/pages/index/index' };
  }
});
