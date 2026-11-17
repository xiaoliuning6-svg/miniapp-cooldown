// 云函数 dailyAggregate —— 定时触发：把冷却结束的单据状态收口
// 说明：冷静期的"到期判定"在前端/读接口按服务端时间实时计算，此定时任务只做兜底收口，
//       避免单据永远停在 cooling；真正的省钱统计在 settle 时累加，不重复计。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const expired = await db.collection('decisions').where({
    status: 'cooling',
    expireAt: _.lte(new Date())
  }).limit(100).get();

  let expiredCount = 0;
  for (const d of expired.data) {
    // 依据投票结果给出建议状态；用户最终是否购买仍由 settle 决定
    const suggest = d.tally && d.tally.reject > d.tally.approve ? 'rejected' : 'passed';
    await db.collection('decisions').doc(d._id).update({
      data: { status: suggest, expiredNotified: false, settledAt: db.serverDate() }
    });
    expiredCount++;
  }
  return { code: 0, data: { processed: expiredCount } };
};
