// 云函数 decisionList —— 审批广场列表 / 我的列表
// 权限：votes/orders 禁止客户端直写，全部走云函数；decisions 读开放，但不返回 openid
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PAGE_SIZE = 10;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { scope = 'plaza', status, page = 1, size = PAGE_SIZE } = event;
  const limit = Math.min(Number(size) || PAGE_SIZE, 20);
  const skip = (Math.max(1, Number(page)) - 1) * limit;

  let where = {};
  if (scope === 'mine') {
    where = { openid: OPENID };
  } else {
    // 广场只看冷静期内的单（可被审批）
    where = { status: 'cooling', expireAt: _.gt(new Date()) };
  }
  if (status) where.status = status;

  const col = db.collection('decisions');
  const total = (await col.where(where).count()).total;
  const { data } = await col.where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip).limit(limit).get();

  // 脱敏：不向客户端返回 openid
  const list = data.map(d => ({
    id: d._id,
    productName: d.productName,
    price: d.price,
    reason: d.reason,
    alternative: d.alternative,
    cooldownHours: d.cooldownHours,
    status: d.status,
    tally: d.tally,
    isMine: d.openid === OPENID,
    expired: new Date(d.expireAt).getTime() <= Date.now(),
    expireAt: d.expireAt,
    createdAt: d.createdAt
  }));

  return { code: 0, data: { list, total, page: Number(page), hasMore: skip + data.length < total } };
};
