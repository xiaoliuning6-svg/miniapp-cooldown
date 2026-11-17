// 云函数 vote —— 投票：一人一票 + 防自投 + 更新计票
// 去重依赖 votes 集合的 (decisionId, openid) 唯一索引（见 database/README.md）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const ERR = { PARAM: 1001, DUPLICATE: 1003, SELF: 1004, NOT_FOUND: 1005, LOCKED: 1006 };

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { decisionId, choice, reason } = event;

  if (!decisionId || !['approve', 'reject'].includes(choice)) {
    return { code: ERR.PARAM, msg: '投票参数不合法' };
  }

  const decisions = db.collection('decisions');
  const { data: docs } = await decisions.where({ _id: decisionId }).limit(1).get();
  if (docs.length === 0) return { code: ERR.NOT_FOUND, msg: '决策单不存在' };
  const decision = docs[0];

  // 不能给自己的单投票
  if (decision.openid === OPENID) return { code: ERR.SELF, msg: '不能给自己的决策单投票' };
  // 冷静期结束后不再接受投票（服务端时间为准）
  if (new Date(decision.expireAt).getTime() <= Date.now()) {
    return { code: ERR.LOCKED, msg: '该决策单审批已结束' };
  }

  const votes = db.collection('votes');
  // 查重（唯一索引是最后防线，这里是友好提示）
  const dup = await votes.where({ decisionId, openid: OPENID }).count();
  if (dup.total > 0) return { code: ERR.DUPLICATE, msg: '你已经投过票了' };

  // 内容安全：投票理由也过检（内联，理由为空则跳过）
  if (reason && String(reason).trim()) {
    try {
      const chk = await cloud.openapi.security.msgSecCheck({
        version: 2, content: String(reason).slice(0, 2500), scene: 2, openid: OPENID
      });
      const s = chk && chk.result && chk.result.suggest;
      if (s === 'risk') return { code: 1002, msg: '评论含敏感信息，请修改' };
    } catch (e) {
      return { code: 1002, msg: '安全校验暂不可用' };
    }
  }

  // 写投票记录
  await votes.add({
    data: {
      decisionId, openid: OPENID, choice,
      reason: String(reason || '').slice(0, 300),
      createdAt: db.serverDate()
    }
  });

  // 原子更新计票（_.inc 避免并发覆盖）
  const field = choice === 'approve' ? 'tally.approve' : 'tally.reject';
  await decisions.doc(decisionId).update({
    data: { [field]: _.inc(1) }
  });

  return { code: 0, data: { ok: true } };
};
