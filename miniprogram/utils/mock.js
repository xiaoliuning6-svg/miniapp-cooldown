// utils/mock.js —— 演示模式本地数据层
// 仅在 DEMO_MODE = true 时启用（见 config.js）。用 wx.Storage 模拟云数据库，
// 函数签名、返回结构、错误码严格对齐 cloudfunctions/ 下的真实云函数，
// 因此 api.js 与所有页面代码无需为演示模式做任何改动。
//
// 注意：这是演示数据，只存在本机，不联网、不上传、无服务端校验。
// 真正的防作弊（服务端时间、唯一索引、内容安全）在云函数里，上线后自动生效。

const { DEMO_OPENID } = require('./config.js');
const { ERR, STATUS } = require('./constants.js');

// v2 = 空库版本。换版本号让旧版预置/测试数据在重新编译后自动失效（旧 key 会被清理）。
const KEY = 'demo_cooldown_db_v2';
const LEGACY_KEYS = ['demo_cooldown_db_v1'];
const iso = (offsetMs) => new Date(Date.now() + (offsetMs || 0)).toISOString();
const HOUR = 3600 * 1000;
const uid = () => 'demo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- 存储层 ----------
function dropLegacy() {
  LEGACY_KEYS.forEach(k => { try { wx.removeStorageSync(k); } catch (e) {} });
}

function db() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (raw && raw.decisions && raw.votes && raw.reports) return raw;
  } catch (e) {}
  dropLegacy(); // 清掉旧版本遗留的演示数据：用户重新编译后即为干净空库，无需手动操作
  const seeded = seed();
  try { wx.setStorageSync(KEY, seeded); } catch (e) {}
  return seeded;
}
function save(d) { try { wx.setStorageSync(KEY, d); } catch (e) {} }

// 初始种子：空库。所有决策单由用户自己发起，数据从零开始增长。
// （旧版预置的示例单已移除；旧 Storage key 在 db() 首次初始化时自动清理。）
function seed() {
  return { decisions: [], votes: [], reports: [] };
}

function mk(_id, openid, productName, price, reason, alternative, cooldownHours, status, expireOffset, createdOffset) {
  return {
    _id, openid, productName, price, reason, alternative, cooldownHours,
    status,
    tally: { approve: 0, reject: 0 },
    expireAt: iso(expireOffset),
    createdAt: iso(createdOffset),
    settledAt: null
  };
}

// ---------- 聚合：省钱账本（单一数据源，从 decisions 算，避免与结算状态不一致）----------
function profile(d) {
  const mine = d.decisions.filter(x => x.openid === DEMO_OPENID);
  const count = s => mine.filter(x => x.status === s).length;
  const totalSaved = mine.filter(x => x.status === STATUS.ABANDONED)
    .reduce((sum, x) => sum + (x.price || 0), 0);
  return {
    totalSaved,
    savedCount: count(STATUS.ABANDONED),
    coolingCount: count(STATUS.COOLING),
    purchasedCount: count(STATUS.PURCHASED),
    memberLevel: 'free'
  };
}

function listItem(x) {
  return {
    id: x._id,
    productName: x.productName,
    price: x.price,
    reason: x.reason,
    alternative: x.alternative,
    cooldownHours: x.cooldownHours,
    status: x.status,
    tally: x.tally,
    isMine: x.openid === DEMO_OPENID,
    expired: new Date(x.expireAt).getTime() <= Date.now(),
    expireAt: x.expireAt,
    createdAt: x.createdAt
  };
}

function ok(data) { return { code: 0, data }; }
function fail(code, msg) { return { code, msg }; }

// ---------- 各"云函数"的本地实现 ----------
const impl = {
  login() {
    return ok({ openid: DEMO_OPENID });
  },

  userProfile() {
    return ok(profile(db()));
  },

  decisionList(data) {
    const d = db();
    const { scope = 'plaza', status, page = 1, size = 10 } = data || {};
    const limit = Math.min(Number(size) || 10, 20);
    const skip = (Math.max(1, Number(page)) - 1) * limit;
    let where;
    if (scope === 'mine') {
      where = d.decisions.filter(x => x.openid === DEMO_OPENID);
    } else {
      where = d.decisions.filter(x => x.status === STATUS.COOLING && new Date(x.expireAt).getTime() > Date.now());
    }
    if (status) where = where.filter(x => x.status === status);
    where.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const list = where.slice(skip, skip + limit).map(listItem);
    return ok({ list, total: where.length, page: Number(page), hasMore: skip + list.length < where.length });
  },

  decisionDetail(data) {
    const d = db();
    const x = d.decisions.find(y => y._id === (data && data.decisionId));
    if (!x) return fail(ERR.NOT_FOUND, '决策单不存在');
    const votes = d.votes
      .filter(v => v.decisionId === x._id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(v => ({ choice: v.choice, reason: v.reason, createdAt: v.createdAt }));
    const tally = x.tally || { approve: 0, reject: 0 };
    const total = (tally.approve || 0) + (tally.reject || 0);
    return ok({
      id: x._id, productName: x.productName, price: x.price, reason: x.reason,
      alternative: x.alternative || '', cooldownHours: x.cooldownHours,
      status: x.status, expireAt: x.expireAt, createdAt: x.createdAt,
      isMine: x.openid === DEMO_OPENID,
      tally: { approve: tally.approve || 0, reject: tally.reject || 0 },
      approvePercent: total ? Math.round(tally.approve / total * 100) : 0,
      rejectPercent: total ? Math.round(tally.reject / total * 100) : 0,
      votes
    });
  },

  decisionPublish(data) {
    const d = db();
    const hours = Number(data && data.cooldownHours) || 24;
    const x = mk(
      uid(), DEMO_OPENID,
      String(data.productName || '').slice(0, 40),
      Number(data.price) || 0,
      String(data.reason || '').slice(0, 200),
      String(data.alternative || '').slice(0, 200),
      hours, STATUS.COOLING,
      hours * HOUR, 0
    );
    d.decisions.unshift(x);
    save(d);
    return ok({ id: x._id });
  },

  vote(data) {
    const d = db();
    const x = d.decisions.find(y => y._id === data.decisionId);
    if (!x) return fail(ERR.NOT_FOUND, '决策单不存在');
    if (x.openid === DEMO_OPENID) return fail(ERR.SELF_VOTE, '不能给自己的决策单投票');
    if (new Date(x.expireAt).getTime() <= Date.now()) return fail(ERR.LOCKED, '冷静期已结束，不能投票');
    if (x.status !== STATUS.COOLING) return fail(ERR.LOCKED, '该决策单已结束');
    const reason = String(data.reason || '').trim();
    if (reason.length < 2) return fail(ERR.PARAM, '请写下至少 2 个字的理由');
    if (!['approve', 'reject'].includes(data.choice)) return fail(ERR.PARAM, '投票选项不合法');
    if (d.votes.some(v => v.decisionId === x._id && v.openid === DEMO_OPENID)) {
      return fail(ERR.DUPLICATE_VOTE, '你已经投过票了');
    }
    d.votes.push({ _id: uid(), decisionId: x._id, openid: DEMO_OPENID, choice: data.choice, reason, createdAt: iso(0) });
    x.tally[data.choice] = (x.tally[data.choice] || 0) + 1;
    save(d);
    return ok({ tally: x.tally });
  },

  settle(data) {
    const d = db();
    const x = d.decisions.find(y => y._id === data.decisionId);
    if (!x) return fail(ERR.NOT_FOUND, '决策单不存在');
    if (x.openid !== DEMO_OPENID) return fail(1007, '只能结算自己的决策单');
    if (new Date(x.expireAt).getTime() > Date.now()) return fail(ERR.LOCKED, '冷静期还没结束，再等等');
    if (!['purchased', 'abandoned'].includes(data.action)) return fail(ERR.PARAM, '操作参数不合法');
    x.status = data.action;
    x.settledAt = iso(0);
    save(d);
    const p = profile(d);
    return ok({ status: data.action, totalSaved: data.action === STATUS.ABANDONED ? p.totalSaved : null });
  },

  report(data) {
    const d = db();
    const x = d.decisions.find(y => y._id === data.decisionId);
    if (!x) return fail(ERR.NOT_FOUND, '决策单不存在');
    if (x.openid === DEMO_OPENID) return fail(ERR.SELF_REPORT, '不能举报自己的决策单');
    const reason = String(data.reason || '').trim();
    if (reason.length < 2) return fail(ERR.PARAM, '请填写至少 2 个字');
    if (d.reports.some(r => r.decisionId === x._id && r.openid === DEMO_OPENID)) {
      return fail(ERR.DUPLICATE_REPORT, '你已经举报过这条内容');
    }
    d.reports.push({ _id: uid(), decisionId: x._id, openid: DEMO_OPENID, reason, createdAt: iso(0) });
    save(d);
    return ok({});
  },

  contentCheck() { return ok({ pass: true }); },
  subscribePush() { return ok({}); },
  dailyAggregate() { return ok({}); },

  // 演示专用：把所有冷静期直接置为已结束，方便立刻验收结算逻辑（真实云端无此函数）
  demoExpireAll() {
    const d = db();
    d.decisions.forEach(x => {
      if (x.status === STATUS.COOLING) x.expireAt = iso(-1000);
    });
    save(d);
    return ok({});
  },

  // 演示专用：清空本机演示数据（测试时提交的单 / 投票 / 举报），恢复初始种子状态
  // 只删 wx.Storage 里的 demo_cooldown_db_v1，不碰任何代码与真实云端数据
  demoReset() {
    dropLegacy();
    try { wx.removeStorageSync(KEY); } catch (e) {}
    const fresh = seed();
    save(fresh);
    return ok({});
  }
};

function mockCall(name, data) {
  const fn = impl[name];
  if (!fn) return fail(ERR.NOT_FOUND, '演示模式不支持此操作：' + name);
  try {
    return fn(data || {});
  } catch (e) {
    return fail(-1, '本地数据异常：' + (e && e.message ? e.message : '未知错误'));
  }
}

module.exports = { mockCall };
