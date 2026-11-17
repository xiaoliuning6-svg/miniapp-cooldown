// pages/detail —— 决策详情：投票 / 结果 / 到期后本人结算
const { call } = require('../../utils/api.js');
const { yuan, timeAgo } = require('../../utils/format.js');
const { DEMO_MODE } = require('../../utils/config.js');

// TODO 替换为公众平台申请到的订阅消息模板 ID（须与 subscribePush 云函数一致）
const SUBSCRIBE_TEMPLATE_ID = 'YOUR_SUBSCRIBE_TEMPLATE_ID';

Page({
  data: {
    id: '', detail: null, loading: true,
    priceText: '', expired: false, isMine: false, canVote: false,
    voting: false, settling: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    if (this.data.id) this.load();
    else {
      this.setData({ loading: false });
      wx.showToast({ title: '缺少决策单 ID', icon: 'none' });
    }
  },

  onPullDownRefresh() { this.load(() => wx.stopPullDownRefresh()); },

  async load(done) {
    try {
      const d = await call('decisionDetail', { decisionId: this.data.id });
      const expired = new Date(d.expireAt).getTime() <= Date.now();
      const votes = (d.votes || []).map(v => ({
        ...v,
        choiceText: v.choice === 'approve' ? '建议买' : '建议别买',
        timeText: timeAgo(v.createdAt)
      }));
      this.setData({
        detail: { ...d, votes, createdText: timeAgo(d.createdAt) },
        priceText: yuan(d.price),
        expired,
        isMine: d.isMine,
        canVote: !d.isMine && !expired && d.status === 'cooling',
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    } finally {
      if (typeof done === 'function') done();
    }
  },

  onNeedReason() {
    wx.showToast({ title: '请写下至少 2 个字的理由', icon: 'none' });
  },

  async onVote(e) {
    if (this.data.voting) return;
    const { choice, reason } = e.detail;
    this.setData({ voting: true });
    try {
      await call('vote', { decisionId: this.data.id, choice, reason });
      wx.showToast({ title: '已提交建议', icon: 'success' });
      await this.load();
    } catch (err) {
      // api.js 已统一提示
    } finally {
      this.setData({ voting: false });
    }
  },

  onSettle(e) {
    const action = e.currentTarget.dataset.action;
    const title = action === 'abandoned' ? '确定放弃购买？' : '确定已经买了？';
    const content = action === 'abandoned'
      ? '这笔钱会计入你的"省下了"总额，不可撤销'
      : '记录后这笔支出不会计入省钱金额';
    wx.showModal({
      title, content,
      confirmText: '确定', cancelText: '再想想',
      success: (r) => { if (r.confirm) this.doSettle(action); }
    });
  },

  async doSettle(action) {
    if (this.data.settling) return;
    this.setData({ settling: true });
    try {
      const res = await call('settle', { decisionId: this.data.id, action });
      wx.showToast({
        title: action === 'abandoned' ? `省下 ¥${yuan(res.totalSaved)}` : '已记录',
        icon: 'success', duration: 2000
      });
      await this.load();
    } catch (err) {
      // api.js 已统一提示
    } finally {
      this.setData({ settling: false });
    }
  },

  onSubscribe() {
    if (DEMO_MODE) {
      wx.showToast({ title: '演示模式：订阅提醒需云端配置', icon: 'none' });
      return;
    }
    if (SUBSCRIBE_TEMPLATE_ID.indexOf('YOUR_') === 0) {
      wx.showToast({ title: '请先在公众平台配置模板 ID', icon: 'none' });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        const ok = res[SUBSCRIBE_TEMPLATE_ID] === 'accept';
        wx.showToast({ title: ok ? '到期会提醒你' : '未开启提醒', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '授权失败，请重试', icon: 'none' })
    });
  },

  // 举报：用 showModal 的 editable 输入框收原因，省一个页面
  // 注：editable 需要较新基础库，以官方文档为准；低版本可用 wx.showActionSheet + 自建表单页降级
  onReport() {
    if (this.data.isMine) {
      wx.showToast({ title: '不能举报自己的决策单', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '举报这个决策单',
      content: '请说明举报原因（至少 2 个字）',
      editable: true,
      placeholderText: '例如：包含广告 / 虚假信息 / 不当内容',
      confirmText: '提交',
      success: (r) => {
        if (!r.confirm) return;
        const reason = (r.content || '').trim();
        if (reason.length < 2) {
          wx.showToast({ title: '请填写至少 2 个字', icon: 'none' });
          return;
        }
        this.submitReport(reason);
      }
    });
  },

  async submitReport(reason) {
    try {
      await call('report', { decisionId: this.data.id, reason });
      wx.showToast({ title: '已收到举报，感谢反馈', icon: 'success' });
    } catch (err) {
      // api.js 已统一提示
    }
  },

  onGoCreate() { wx.switchTab({ url: '/pages/create/create' }); },

  onShareAppMessage() {
    const d = this.data.detail;
    return {
      title: d ? `帮我看看：${d.productName}，¥${this.data.priceText} 值不值得买` : '买之前，先冷静一下',
      path: `/pages/detail/detail?id=${this.data.id}`
    };
  }
});
