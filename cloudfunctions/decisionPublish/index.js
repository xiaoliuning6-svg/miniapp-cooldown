// 云函数 decisionPublish —— 提交决策单：参数校验 + 内容安全 + 入库
// 注意：云函数各自独立部署，不能 require 另一个云函数目录的代码。
// 因此 msgSecCheck 逻辑内联于此（与 contentCheck 云函数保持一致）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ERR = { PARAM: 1001, CONTENT_RISK: 1002 };
const ALLOWED_HOURS = [1, 12, 24, 72];

// 内联内容安全校验（入参/返回以官方文档核实）
async function check(text, openid) {
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      content: String(text).slice(0, 2500),
      scene: 2,
      openid
    });
    const suggest = res && res.result && res.result.suggest;
    return { pass: suggest !== 'risk' && suggest !== 'review', suggest };
  } catch (err) {
    console.error('msgSecCheck 异常:', err);
    return { pass: false, reason: '安全校验暂不可用，请稍后重试' };
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { productName, price, reason, alternative, cooldownHours } = event;

  // 1. 参数校验（金额单位：分）
  if (!productName || !Number.isInteger(price) || price <= 0 || !reason) {
    return { code: ERR.PARAM, msg: '请填写完整的商品名、金额和购买理由' };
  }
  const hours = ALLOWED_HOURS.includes(cooldownHours) ? cooldownHours : 24;

  // 2. 内容安全
  const safe = await check(`${productName} ${reason} ${alternative || ''}`, OPENID);
  if (!safe.pass) {
    return { code: ERR.CONTENT_RISK, msg: safe.reason || '内容含敏感信息，请修改后再提交' };
  }

  // 3. 入库：expireAt 用服务端时间计算，防本机改时间作弊
  const expireAt = new Date(Date.now() + hours * 3600 * 1000);
  const res = await db.collection('decisions').add({
    data: {
      openid: OPENID,
      productName: String(productName).slice(0, 60),
      price,
      reason: String(reason).slice(0, 500),
      alternative: String(alternative || '').slice(0, 500),
      cooldownHours: hours,
      status: 'cooling',
      tally: { approve: 0, reject: 0 },
      expireAt,
      createdAt: db.serverDate()
    }
  });

  return { code: 0, data: { id: res._id, expireAt } };
};
