# 云数据库：集合、索引与权限

MVP 共 4 个集合。所有读写都经云函数，**客户端不直连数据库**（避免权限绕过）。

## 一、创建集合

在微信开发者工具 → 云开发 → 数据库 → 新建集合，逐个创建：

| 集合 | 用途 | 建议权限 | 说明 |
|---|---|---|---|
| `users` | 用户档案、累计省钱金额 | 仅云函数可读写 | openid 由 `getWXContext` 获取，不下发前端 |
| `decisions` | 决策单主表 | 仅云函数可读写 | 列表/详情均走 `decisionList` / `decisionDetail` |
| `votes` | 投票记录 | 仅云函数可读写 | 一人一票靠唯一索引兜底 |
| `reports` | 举报记录 | 仅云函数可读写 | 举报原因留痕，防重复举报靠唯一索引 |

> 定稿：**不创建 `orders` 集合**（本项目永久不接支付）。

> 权限设置位置：集合右键 → 权限设置 → 选择「仅云函数可读写」。
> 若后台只有「所有用户可读，仅创建者可写」等预设，选最严格的那个；云函数始终有 admin 权限。

## 二、索引（必建，否则数据量上去会全表扫描）

在集合的「索引管理」页添加：

### `users`
| 索引名 | 字段 | 唯一 | 用途 |
|---|---|---|---|
| `openid_unique` | `openid` 升序 | ✅ 是 | 登录幂等，防重复建档 |

### `decisions`
| 索引名 | 字段 | 唯一 | 用途 |
|---|---|---|---|
| `status_createdAt` | `status` 升序 + `createdAt` 降序 | 否 | 广场列表 `{status:'cooling'}` 排序分页 |
| `openid_createdAt` | `openid` 升序 + `createdAt` 降序 | 否 | 「我的」列表 |
| `expireAt_idx` | `expireAt` 升序 | 否 | 到期筛选 `expireAt > now` |
| `createdAt_idx` | `createdAt` 降序 | 否 | 通用时间倒序 |

### `votes`
| 索引名 | 字段 | 唯一 | 用途 |
|---|---|---|---|
| `decision_openid_unique` | `decisionId` 升序 + `openid` 升序 | ✅ 是 | **一人一票最后防线**，并发下防重复投票 |
| `decisionId_idx` | `decisionId` 升序 | 否 | 查某单的投票理由列表 |

### `reports`
| 索引名 | 字段 | 唯一 | 用途 |
|---|---|---|---|
| `decision_reporter_unique` | `decisionId` 升序 + `reporterOpenid` 升序 | ✅ 是 | **防同一人重复举报同一单** |
| `decision_createdAt` | `decisionId` 升序 + `createdAt` 降序 | 否 | 按决策单查举报（处理后台用） |

## 三、定时触发器

`cloudfunctions/dailyAggregate/config.json` 已配置每天 09:00（北京时间）触发：

```json
{
  "triggers": [
    {
      "name": "dailyAggregateTimer",
      "type": "timer",
      "config": "0 0 9 * * * * *"
    }
  ]
}
```

cron 为 7 位（秒 分 时 日 月 周 年）。上传云函数时**必须同时上传 config.json**，否则触发器不生效。
在云开发控制台 → 云函数 → dailyAggregate → 触发器 页可确认是否注册成功。

## 四、数据字段约定

### `decisions`
```js
{
  _id, openid,
  productName: String,   // ≤60 字
  price: Number,         // 单位：分（不是元！）
  reason: String,        // ≤500 字
  alternative: String,   // ≤500 字
  cooldownHours: Number, // 1 | 12 | 24 | 72
  status: String,        // cooling | purchased | abandoned
  tally: { approve: Number, reject: Number },
  expireAt: Date,        // 服务端时间计算，防改本机时间
  createdAt: Date,
  settledAt: Date        // 结算后写入
}
```

### `votes`
```js
{
  _id, decisionId, openid,
  choice: 'approve' | 'reject',
  reason: String,        // ≤300 字，投票时强制 ≥2 字
  createdAt: Date
}
```

### `users`
```js
{
  _id, openid, unionid,
  memberLevel: 'free',   // 恒为 free，无支付、不参与逻辑
  totalSaved: Number,    // 单位：分，由 settle 原子累加
  createdAt: Date, lastLoginAt: Date
}
```

### `reports`
```js
{
  _id, decisionId, reporterOpenid,
  reason: String,        // 举报原因，≤300 字，强制 ≥2 字
  status: 'pending',     // pending | handled | ignored
  createdAt: Date
}
```

## 五、常见故障对照

| 现象 | 根因 | 处理 |
|---|---|---|
| 列表一直为空 | 集合权限设成「仅创建者可读写」但云函数用了 admin 查询之外的方式 | 确认集合已建、权限为「仅云函数可读写」 |
| 重复投票成功 | `votes` 唯一索引没建 | 建 `decision_openid_unique` 唯一索引 |
| 重复举报成功 | `reports` 唯一索引没建 | 建 `decision_reporter_unique` 唯一索引 |
| 首次启动没弹隐私说明 | 本地缓存已写过同意标记 | 开发者工具清 Storage 后重载 |
| 倒计时能提前结算 | 前端时间参与判定 | 检查 `settle` 是否用服务端 `Date.now()` 比较 `expireAt` |
| 定时汇总没跑 | 上传云函数时漏传 `config.json` | 重新上传整个目录并确认触发器列表 |
| 内容安全调用报错 | 未开通内容安全或接口版本不匹配 | 云开发控制台开通内容安全，参数以官方文档为准 |
