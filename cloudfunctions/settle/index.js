// 云函数 settle —— 冷静期结束后，用户本人确认「已购买」或「已放弃」
// 服务端强制校验冷静期是否结束 + 是否本人，防绕过
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ERR = { PARAM: 1001, NOT_FOUND: 1005, LOCKED: 1006, FORBIDDEN: 1007 };

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { decisionId, action } = event; // action: purchased | abandoned

  if (!decisionId || !['purchased', 'abandoned'].includes(action)) {
    return { code: ERR.PARAM, msg: '操作参数不合法' };
  }

  const decisions = db.collection('decisions');
  const { data: docs } = await decisions.where({ _id: decisionId }).limit(1).get();
  if (docs.length === 0) return { code: ERR.NOT_FOUND, msg: '决策单不存在' };
  const d = docs[0];

  if (d.openid !== OPENID) return { code: ERR.FORBIDDEN, msg: '只能操作自己的决策单' };
  if (new Date(d.expireAt).getTime() > Date.now()) {
    return { code: ERR.LOCKED, msg: '冷静期还没结束，再等等' };
  }

  await decisions.doc(decisionId).update({
    data: { status: action, settledAt: db.serverDate() }
  });

  // 放弃购买 → 累计省钱金额 +price（分）
  let totalSaved = null;
  if (action === 'abandoned') {
    await db.collection('users').where({ openid: OPENID }).update({
      data: { totalSaved: db.command.inc(d.price || 0) }
    });
    const { data: u } = await db.collection('users').where({ openid: OPENID }).limit(1).get();
    totalSaved = u[0] && u[0].totalSaved;
  }

  return { code: 0, data: { status: action, totalSaved } };
};
