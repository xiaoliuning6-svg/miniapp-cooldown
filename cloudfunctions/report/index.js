// 云函数 report —— 举报决策单内容
// 防重复：reports 集合 (decisionId, reporterOpenid) 唯一索引为最后防线，此处查询做友好提示
// 举报原因也要过内容安全（与 vote 保持一致）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ERR = {
  PARAM: 1001,
  CONTENT_RISK: 1002,
  DUPLICATE: 1008,
  NOT_FOUND: 1005,
  SELF: 1009
};

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { decisionId, reason } = event;

  if (!decisionId || !reason || String(reason).trim().length < 2) {
    return { code: ERR.PARAM, msg: '请填写至少 2 个字的举报原因' };
  }

  const decisions = db.collection('decisions');
  const { data: docs } = await decisions.where({ _id: decisionId }).limit(1).get();
  if (docs.length === 0) return { code: ERR.NOT_FOUND, msg: '决策单不存在' };
  if (docs[0].openid === OPENID) return { code: ERR.SELF, msg: '不能举报自己的决策单' };

  const reports = db.collection('reports');
  const dup = await reports.where({ decisionId, reporterOpenid: OPENID }).count();
  if (dup.total > 0) return { code: ERR.DUPLICATE, msg: '你已经举报过这个决策单了' };

  // 举报原因内容安全（内联，理由为空已在上面拦截）
  try {
    const chk = await cloud.openapi.security.msgSecCheck({
      version: 2, content: String(reason).slice(0, 2500), scene: 2, openid: OPENID
    });
    const s = chk && chk.result && chk.result.suggest;
    if (s === 'risk' || s === 'review') {
      return { code: ERR.CONTENT_RISK, msg: '举报原因含敏感信息，请修改' };
    }
  } catch (e) {
    return { code: ERR.CONTENT_RISK, msg: '安全校验暂不可用，请稍后重试' };
  }

  await reports.add({
    data: {
      decisionId,
      reporterOpenid: OPENID,
      reason: String(reason).trim().slice(0, 300),
      status: 'pending',
      createdAt: db.serverDate()
    }
  });

  return { code: 0, data: { ok: true } };
};
