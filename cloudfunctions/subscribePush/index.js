// 云函数 subscribePush —— 发送订阅消息（冷静期到期 / 审批结果提醒）
// 前置：① 小程序后台配置订阅消息模板 ② 前端 wx.requestSubscribeMessage 获取用户授权
// 模板 ID、字段名（thing1/time2 等）以你在微信公众平台申请到的模板为准，此处为占位示意
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TEMPLATE_ID = 'YOUR_SUBSCRIBE_TEMPLATE_ID'; // TODO 替换

exports.main = async (event) => {
  const { decisionId, type = 'expire' } = event; // expire | result
  const { data: docs } = await db.collection('decisions').where({ _id: decisionId }).limit(1).get();
  if (docs.length === 0) return { code: 1005, msg: '决策单不存在' };
  const d = docs[0];

  const data = type === 'expire'
    ? {
        thing1: { value: String(d.productName).slice(0, 20) },
        time2: { value: formatTime(d.expireAt) },
        thing3: { value: '冷静期已结束，来看看建议' }
      }
    : {
        thing1: { value: String(d.productName).slice(0, 20) },
        thing2: { value: `赞成${d.tally.approve} · 反对${d.tally.reject}` },
        thing3: { value: '你的决策单有新投票' }
      };

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: d.openid,
      templateId: TEMPLATE_ID,
      page: `pages/detail/detail?id=${decisionId}`,
      data,
      miniprogramState: 'formal' // formal | trial | developer，按环境调整
    });
    return { code: 0, data: { sent: true } };
  } catch (err) {
    // 用户未授权/拒收是常见情况，不视为系统错误
    console.warn('订阅消息发送失败:', err.errCode, err.errMsg);
    return { code: 0, data: { sent: false, reason: err.errMsg } };
  }
};

function formatTime(d) {
  const t = new Date(d);
  const p = x => String(x).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
