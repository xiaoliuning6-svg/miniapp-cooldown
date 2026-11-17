// 云函数 userProfile —— 「我的」页聚合数据
// 省钱金额以 users.totalSaved 为准（由 settle 云函数原子累加），不信任前端计算
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { code: 1001, msg: '无法获取 openid' };

  const { data: users } = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  const user = users[0] || {};

  // 按状态计数（三种聚合查询并行）
  const decisions = db.collection('decisions');
  const [cooling, abandoned, purchased] = await Promise.all([
    decisions.where({ openid: OPENID, status: 'cooling' }).count(),
    decisions.where({ openid: OPENID, status: 'abandoned' }).count(),
    decisions.where({ openid: OPENID, status: 'purchased' }).count()
  ]);

  return {
    code: 0,
    data: {
      totalSaved: user.totalSaved || 0,       // 单位：分
      savedCount: abandoned.total,            // 放弃次数 = 省下次数
      coolingCount: cooling.total,
      purchasedCount: purchased.total,
      memberLevel: user.memberLevel || 'free'
    }
  };
};
