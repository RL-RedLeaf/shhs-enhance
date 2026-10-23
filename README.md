# SHHS Post · 前端（重构版）

> 仓库名：`shhs-enhance`

无源码条件下按线上行为逆向重建的 React 前端。双 HTML 入口结构与服务器现有页面路由表完全对齐，部署零改服务器。

- 技术栈：React 18.3 + Ant Design 5 + Vite 6 + TypeScript strict
- 双入口：`index.html`（公开查询）与 `login.html`（登录 / 改密 / 账号 / 账号管理）
- 设计 token 从原站手写 CSS 逐值映射进 antd theme：`--green #164d3d`、正文 `#252d29`、边框 `#d7ddd9`、输入框边 `#bfcac3`、圆角 4px、Inter/微软雅黑字体栈
- 两字按钮不加空格（`button={{ autoInsertSpace: false }}`），贴合原站紧凑风
- 二维码：`qrcode`（node-qrcode，与原站同款库）经动态 import 懒加载 chunk；内容为 `{origin}/?route={id}`，扫码直达该邮路。生成参数 `{ margin: 4, width: 185 }`——静区满足 ISO/IEC 18004 的 4 模块要求，185 = (29+4×2)×5 保证整数缩放；`<img>` 仍按 160×160 显示
- 页脚保留：沪ICP备2026049485号（备案链接）+ Designed & Developed by linle_1222

## 本地开发

```
cd web
npm install
npm run dev        # http://localhost:5173
```

- dev 服务器把 `/api` 代理到 `https://shhspost.cn`，公开 GET（metadata / routes / announcements）直读线上真实数据。
- **dev 环境写接口（登录、改密、反馈提交、管理端写操作）会被服务器边缘的源校验拦截（403），属预期**——完整写流程需部署到你自己的测试环境后再验证。
- 本地访问登录页用 `/login.html`（生产对应 `/login`，由服务器路由表分发）。

## 构建与部署

```
npm run build      # 产出 dist/
```

`dist/` 内容：`index.html`、`login.html`、`assets/*`。

部署 = 把这两个 HTML 与 `assets/` 覆盖服务器现有静态文件。服务器页面路由表不变：

| 服务器路径 | 出口 | 页面 |
| --- | --- | --- |
| `/` | index.html | 公开查询（学校对级联查询、邮路直链 `?route=`、初始未查询空态页、公告、反馈） |
| `/workbench` | index.html | 学校工作台——**当前为占位面板，下一批次迁移** |
| `/login` | login.html | 登录（含首登强制改密视图切换） |
| `/change-password` | login.html | 改密（直达形态：需当前密码） |
| `/account` | login.html | 账号信息 + 退出登录 |
| `/admin/accounts` | login.html | 账号管理（组织管理员） |

## API 契约要点（均已按线上实测建模）

- 统一错误 `{error, code}`：`NOT_FOUND` / `AUTH_REQUIRED` / `INVALID_CREDENTIALS` / `RATE_LIMITED`（带 `Retry-After`）/ `ROUTE_NOT_FOUND` 等，见 `src/lib/api.ts` 的 `ApiError`。
- 邮路详情 `GET /api/public/routes/{id}`（仅在深链 `?route=` 时调用，不自动载默认邮路）；学校对查询 `GET /api/public/routes?cycle&from_school&to_school`。
- 首页初始状态：不查询不载邮路、URL 保持 `/`（线上原站 bundle 无 `replaceState`/`pushState`，前端不改地址）；渲染「选择寄件与收件学校后查询邮路」空态面板。
- `routes[].updatedAt` 为 ISO 时间戳（如 `2026-10-23T14:11:33.038Z`），展示统一走 `new Date(...).toLocaleString('zh-CN')`（⇒ `2026/10/23 22:11:33`），无值时兜底「暂无记录」。
- 左卡片信息（自上而下，与线上实测 R6273 对齐）：`{寄件校名} → {收件校名} · {cycle}`、`当前状态`（最后一个已完成步骤的 label，无任何完成步骤时回退「暂无已确认进度」）、`最后更新时间`、可收起的「分装袋二维码 / 短编号」（原生 `<details>`，内含二维码图与 `SH26-xxxx · Rxxxx` 两行）。
- **右卡（投递进度）**：h2「投递进度」+ 时间线：22px 圆点，**无文字（已完成实心绿、未完成空心灰线）**；`li:before` 竖线连通相邻节点，`li.done` 时连线与圆点填充绿色；阶段名 `strong` 换行、`学校 · 日期`（无日期回退「日期未知 / 等待记录」）用 `small`、来源用右侧 `tag`（`source="暂无记录"` 不渲染 tag）。多批次时每节前加 `batch-chip`（`首批` / `逻辑批次 {n}`），单批次不显示 chip。
- **未实体化邮路**：学校对查询命中虚拟投影时返回 `routes[{id:null, materialized:false}]` + `virtualProjection: Projection[]`（数组形态，与 `projections` 值同构）。左卡片**无二维码 / 短编号入口**；右卡按 `virtualProjection` 渲染灰点投影步骤。
- 公告：`GET /api/public/announcements`，线上字段为 `pinned`（布尔）与 `published_at`（Unix 毫秒）。**位置在页面顶部（header 与查询条之间）**，排序置顶优先；每条原生 `<details>` 折叠（默认收起），summary 为 `置顶 · {title}`（pinned 时）；正文换行保留，底部 `new Date(published_at).toLocaleString('zh-CN')`；超过 3 条时出现「查看全部公告 / 收起公告」切换。无公告时整块不渲染。
- `displayVerified=false` 不再渲染额外提示条（按当前版本的卡片信息清单精简）；`displayVerified` 字段仍在类型中保留。

## 账号管理（/admin/accounts）联调提示

该接口族的响应字段形状按逆向推断，代码已做防御性兼容：
- 列表：`rowsOf()` 会尝试 `items` / `accounts` / `rows` / 裸数组四种形态；
- 临时密码：`tempPasswordOf()` 会尝试 `temporary_password` / `temp_password` / `one_time_password` / `password` 四个键。

若联调时字段名不符，只需调整 `src/pages/AdminAccounts.tsx` 中这两个函数。

## 后续优化空间

- antd 共享 chunk 约 300KB gzip（Table/Form/Modal 依赖的必然开销）；如需瘦身可按入口拆分或改 pure-component 按需引入。
- 工作台（方向表单、节点候选、操作预览/提交、事实登记）在下一批次迁移，接口契约见 `src/lib/api.ts` 与 `src/lib/types.ts` 中的既有建模。


## 许可

[MIT](./LICENSE) © 2026 RL-RedLeaf

本项目是对 `shhspost.cn` 线上行为的独立重实现，仅用于前端工程实践；原站业务数据、校名名录与设计归属原作者 `linle_1222`，不在本仓库授权范围内。

