// 云函数 login —— 静默登录，用 getWXContext 拿 openid，前端不接触 session_key
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) return { code: 1001, msg: '无法获取 openid' };

  const users = db.collection('users');
  const { data: exist } = await users.where({ openid: OPENID }).limit(1).get();

  if (exist.length === 0) {
    await users.add({
      data: {
        openid: OPENID,
        unionid: UNIONID || '',
        memberLevel: 'free',
        totalSaved: 0,
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate()
      }
    });
  } else {
    await users.doc(exist[0]._id).update({ data: { lastLoginAt: db.serverDate() } });
  }

  return { code: 0, data: { openid: OPENID } };
};
