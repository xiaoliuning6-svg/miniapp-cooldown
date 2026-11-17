// utils/config.js —— 单一配置源
// 【演示模式 / 真实云端】的唯一开关，只改这里一处即可。
//
// 现状：CLOUD_ENV 还是占位符 → DEMO_MODE = true → 全部数据走本地（wx.Storage），
//       导入微信开发者工具即可点通完整闭环，不需要 AppID、不需要云环境、不需要上传云函数。
//
// 要上线/真机联调时：
//   1) 把 CLOUD_ENV 换成你自己的云开发环境 ID（形如 xxx-1gxxxxxx）
//   2) 把 project.config.json 里的 appid 换成你自己的小程序 AppID
//   3) 建集合和索引、上传 cloudfunctions/ 下全部云函数
//   4) 替换 detail.js 里的订阅消息模板 ID
// 完成第 1 步后 DEMO_MODE 自动变 false，api.js 会自动改走云端，无需改其他代码。

const CLOUD_ENV = 'YOUR_CLOUD_ENV_ID';

// 占位符判定：以 YOUR_ 开头或留空，都视为演示模式
const DEMO_MODE = !CLOUD_ENV || CLOUD_ENV.indexOf('YOUR_') === 0;

// 演示模式下的固定身份（模拟 openid），不上传、不联网
const DEMO_OPENID = 'demo-openid-local';

module.exports = { CLOUD_ENV, DEMO_MODE, DEMO_OPENID };
