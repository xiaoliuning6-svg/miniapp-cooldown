// utils/api.js —— 云函数统一封装
// 约定：所有云函数返回 { code: 0, data, msg? }；code 非 0 视为业务错误
// 演示模式：CLOUD_ENV 还是占位符时自动走本地数据层，页面代码无感知。
const { ERR } = require('./constants');
const { DEMO_MODE } = require('./config.js');
const { mockCall } = require('./mock.js');

async function call(name, data = {}, opts = {}) {
  try {
    let result;
    if (DEMO_MODE) {
      result = mockCall(name, data);
    } else {
      const res = await wx.cloud.callFunction({ name, data });
      result = res.result || {};
    }
    if (result.code !== 0) {
      const err = new Error(result.msg || '操作失败');
      err.code = result.code;
      err.msg = result.msg || '操作失败'; // 供下方 toast 使用，不能只靠 message
      throw err;
    }
    return result.data;
  } catch (err) {
    if (opts.silent !== true) {
      wx.showToast({ title: err.msg || '网络异常，请重试', icon: 'none' });
    }
    throw err;
  }
}

module.exports = { call, ERR };
