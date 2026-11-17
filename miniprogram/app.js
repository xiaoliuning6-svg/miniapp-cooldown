// app.js
// 云环境 ID 现在集中在 utils/config.js 管理（单一开关源）：
//   占位符 → 演示模式（本地数据，导入即用）
//   填真实 ID → 自动切换云端
const { CLOUD_ENV, DEMO_MODE, DEMO_OPENID } = require('./utils/config.js');

App({
  globalData: {
    openid: '',
    envReady: false,
    demoMode: DEMO_MODE
  },

  onLaunch() {
    if (DEMO_MODE) {
      // 演示模式：跳过云初始化，用本地 openid，无需 AppID / 云环境
      this.globalData.openid = DEMO_OPENID;
      this.globalData.envReady = true;
      console.info('[冷静一下] 演示模式已开启：数据存本机，填 CLOUD_ENV 后自动切云端');
      return;
    }

    if (!wx.cloud) {
      console.error('基础库版本过低，请使用 2.2.3 及以上基础库（以官方文档为准）');
      return;
    }
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true
    });
    this.globalData.envReady = true;

    // 静默登录：云函数通过 getWXContext 拿 openid，前端不存 session_key
    this.ensureLogin();
  },

  // 幂等登录：全局只调一次，其他页面等待这个 Promise
  async ensureLogin() {
    if (DEMO_MODE) return DEMO_OPENID;
    if (this._loginPromise) return this._loginPromise;
    this._loginPromise = wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        this.globalData.openid = res.result.data.openid;
        return this.globalData.openid;
      })
      .catch(err => {
        console.error('登录失败:', err);
        this._loginPromise = null; // 允许下次重试
        throw err;
      });
    return this._loginPromise;
  }
});
