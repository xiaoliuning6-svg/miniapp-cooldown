// components/privacy —— 首次启动隐私说明
// 存储键与微信官方隐私保护指引无自动关联，仅作本产品的"已告知"留痕；
// 公众平台侧《用户隐私保护指引》仍需开发者自行配置（以官方最新规范为准）。
const STORAGE_KEY = 'cooldown_privacy_agreed_v1';

Component({
  data: { visible: false },
  lifetimes: {
    attached() {
      try {
        const agreed = wx.getStorageSync(STORAGE_KEY);
        if (agreed !== true) this.setData({ visible: true });
      } catch (e) {
        // 存储不可用时保守展示
        this.setData({ visible: true });
      }
    }
  },
  methods: {
    onAgree() {
      try { wx.setStorageSync(STORAGE_KEY, true); } catch (e) { /* 忽略存储失败 */ }
      this.setData({ visible: false });
      this.triggerEvent('agree');
    },
    onDisagree() {
      // 不强制退出：拒绝后仍可用，但不写同意标记，下次启动再提示。
      // 这样避免"不点同意就完全不能用"的审核风险，也给用户真实选择权。
      this.setData({ visible: false });
      this.triggerEvent('disagree');
    },
    onOpenDetail() {
      // 隐私说明全文的展开位；若后续接入微信 official 隐私协议页，在此跳转
      this.triggerEvent('opendetail');
    }
  }
});
