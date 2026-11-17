// utils/format.js —— 金额与时间格式化

// 分 → 元字符串（去尾零）
function yuan(fen) {
  if (fen == null) return '0';
  return (fen / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

// 元输入 → 分（校验两位小数）
function toFen(input) {
  const n = Number(input);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

// 倒计时：毫秒差 → { h, m, s, expired, text }
function countdown(expireAt) {
  const diff = new Date(expireAt).getTime() - Date.now();
  if (diff <= 0) return { expired: true, h: 0, m: 0, s: 0, text: '已结束' };
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = x => String(x).padStart(2, '0');
  return { expired: false, h, m, s, text: `${pad(h)}:${pad(m)}:${pad(s)}` };
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

module.exports = { yuan, toFen, countdown, timeAgo };
