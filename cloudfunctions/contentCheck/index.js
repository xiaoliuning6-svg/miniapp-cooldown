// 云函数 contentCheck —— 文本安全校验（msgSecCheck 云调用）
// 提示：msgSecCheck 的入参/返回结构随基础库与接口版本演进，务必以官方文档核实。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * @param {string} text 待检文本
 * @param {string} openid 用户 openid（v2 接口需要）
 * @returns {{ pass: boolean, label?: number }}
 */
async function check(text, openid) {
  if (!text || !text.trim()) return { pass: false, reason: '内容不能为空' };
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      content: String(text).slice(0, 2500),
      scene: 2,          // 2=评论；发布场景可按需调整，以官方文档为准
      openid
    });
    // 常见返回：suggest = pass | review | risk
    const suggest = res && res.result && res.result.suggest;
    return { pass: suggest !== 'risk' && suggest !== 'review', suggest };
  } catch (err) {
    console.error('msgSecCheck 调用异常:', err);
    // 安全策略：校验服务异常时拒绝提交（fail-closed），避免违规内容漏过
    return { pass: false, reason: '安全校验暂不可用，请稍后重试' };
  }
}

exports.main = async (event) => {
  const { text, openid } = event;
  const r = await check(text, openid);
  return { code: 0, data: r };
};

module.exports = { check };
