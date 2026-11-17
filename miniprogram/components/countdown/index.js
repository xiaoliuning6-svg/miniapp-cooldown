// components/countdown —— 冷静期倒计时
// 时间源是服务端下发的 expireAt（绝对时间），前端只做展示，防改本机时间作弊
const { countdown } = require('../../utils/format.js');

Component({
  properties: {
    expireAt: { type: String, value: '' },
    compact: { type: Boolean, value: false }
  },
  data: { text: '', expired: false },
  observers: {
    'expireAt': function () { this.tick(); }
  },
  lifetimes: {
    attached() { this.tick(); this._timer = setInterval(() => this.tick(), 1000); },
    detached() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
  },
  pageLifetimes: {
    show() { this.tick(); },
    hide() { /* 页面隐藏不清理，由 detached 统一清理，避免频繁重建 */ }
  },
  methods: {
    tick() {
      if (!this.data.expireAt) return;
      const r = countdown(this.data.expireAt);
      this.setData({ text: r.text, expired: r.expired });
      if (r.expired && this._timer) {
        clearInterval(this._timer);
        this._timer = null;
        this.triggerEvent('expired');
      }
    }
  }
});
