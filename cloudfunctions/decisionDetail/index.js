// 云函数 decisionDetail —— 决策单详情 + 最近投票理由
// 脱敏：不向客户端返回任何 openid；投票只展示理由和选择
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ERR = { PARAM: 1001, NOT_FOUND: 1005 };

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { decisionId } = event;
  if (!decisionId) return { code: ERR.PARAM, msg: '缺少决策单 ID' };

  const { data: docs } = await db.collection('decisions').where({ _id: decisionId }).limit(1).get();
  if (docs.length === 0) return { code: ERR.NOT_FOUND, msg: '决策单不存在' };
  const d = docs[0];

  // 最近 10 条投票理由（云函数有权限读 votes，客户端无直读权限）
  const { data: votes } = await db.collection('votes')
    .where({ decisionId })
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const tally = d.tally || { approve: 0, reject: 0 };
  const total = (tally.approve || 0) + (tally.reject || 0);

  return {
    code: 0,
    data: {
      id: d._id,
      productName: d.productName,
      price: d.price,
      reason: d.reason,
      alternative: d.alternative || '',
      cooldownHours: d.cooldownHours,
      status: d.status,
      expireAt: d.expireAt,
      createdAt: d.createdAt,
      isMine: d.openid === OPENID,
      tally: { approve: tally.approve || 0, reject: tally.reject || 0 },
      approvePercent: total ? Math.round(tally.approve / total * 100) : 0,
      rejectPercent: total ? Math.round(tally.reject / total * 100) : 0,
      votes: votes.map(v => ({
        choice: v.choice,
        reason: v.reason,
        createdAt: v.createdAt
      }))
    }
  };
};
