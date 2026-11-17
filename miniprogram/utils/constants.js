// utils/constants.js —— 常量与枚举（前端与云函数保持一致）

// 决策单状态
const STATUS = {
  COOLING: 'cooling',       // 冷静期倒计时中
  PASSED: 'passed',         // 投票通过（到期后判定）
  REJECTED: 'rejected',     // 投票驳回（到期后判定）
  PURCHASED: 'purchased',   // 用户确认已购买
  ABANDONED: 'abandoned'    // 用户放弃购买
};

const STATUS_TEXT = {
  cooling: '冷静中',
  passed: '大家建议买',
  rejected: '大家建议别买',
  purchased: '已购买',
  abandoned: '已放弃 · 省下了'
};

// 投票选项
const VOTE = { APPROVE: 'approve', REJECT: 'reject' };

// 冷静时长选项（小时）
const COOLDOWN_OPTIONS = [
  { label: '1 小时', value: 1 },
  { label: '12 小时', value: 12 },
  { label: '24 小时', value: 24 },
  { label: '72 小时', value: 72 }
];

// 错误码（云函数与前端共用）
const ERR = {
  OK: 0,
  PARAM: 1001,          // 参数不合法
  CONTENT_RISK: 1002,   // 内容风险
  DUPLICATE_VOTE: 1003, // 重复投票
  SELF_VOTE: 1004,      // 给自己的单投票
  NOT_FOUND: 1005,      // 记录不存在
  LOCKED: 1006,         // 冷静期未结束
  DUPLICATE_REPORT: 1008, // 重复举报
  SELF_REPORT: 1009     // 举报自己的内容
};

module.exports = { STATUS, STATUS_TEXT, VOTE, COOLDOWN_OPTIONS, ERR };
