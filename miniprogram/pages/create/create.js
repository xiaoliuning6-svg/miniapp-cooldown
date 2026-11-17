// pages/create —— 提交决策单
const { call } = require('../../utils/api.js');
const { COOLDOWN_OPTIONS } = require('../../utils/constants.js');
const { toFen } = require('../../utils/format.js');

Page({
  data: {
    productName: '', priceInput: '', reason: '', alternative: '',
    cooldownOptions: COOLDOWN_OPTIONS, cooldownIndex: 2, // 默认 24h
    submitting: false
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  onCooldownChange(e) { this.setData({ cooldownIndex: Number(e.detail.value) }); },

  // 提交成功后清空表单：create 是 tabBar 页，switchTab 不会销毁页面实例，
  // 不清空则下次点"发起审批"回来还是上一次填的内容（用户 2026-11-17 反馈）。
  // 只在提交成功时调用——填一半切走再回来，草稿仍保留。
  resetForm() {
    this.setData({
      productName: '', priceInput: '', reason: '', alternative: '',
      cooldownIndex: 2 // 冷静时长恢复默认 24h，保证是全新一单
    });
  },

  async onSubmit() {
    const { productName, priceInput, reason, alternative, cooldownOptions, cooldownIndex } = this.data;
    if (!productName.trim() || !reason.trim()) {
      wx.showToast({ title: '请填写商品名和购买理由', icon: 'none' }); return;
    }
    const price = toFen(priceInput);
    if (price == null || price <= 0) {
      wx.showToast({ title: '金额格式不对', icon: 'none' }); return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    try {
      await call('decisionPublish', {
        productName: productName.trim(),
        price,
        reason: reason.trim(),
        alternative: alternative.trim(),
        cooldownHours: cooldownOptions[cooldownIndex].value
      });
      wx.showToast({ title: '已提交，先冷静冷静', icon: 'success' });
      this.resetForm(); // 立即清空，避免跳回后再次进入时残留
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 800);
    } catch (e) {
      // 错误提示已在 api.js 统一处理
    } finally {
      this.setData({ submitting: false });
    }
  }
});
