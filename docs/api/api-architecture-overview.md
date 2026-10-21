# API 架构总览（全局约定）

> 范围：`apps/server` 对外 HTTP 服务面的全局语义。具体业务语义在各域文档，字段结构在 `openapi.json`。

## 1. 路由与前缀

- 全局前缀 `/api/v1`（Nginx 将 `/api/v1/*` 反代到 server）。
- 版本只在路径体现一次，不做同版本多实现分叉。
- Swagger 仅非生产暴露：`/api/v1/docs`。

## 2. 鉴权：双通道（`plans/05` v1.4 拍板）

| 端 | 通道 | 载体 | 说明 |
|---|---|---|---|
| portal（门户/会员） | 同域 Cookie | `pte_at`（access）、`pte_rt`（refresh，Path=/auth） | 均 `HttpOnly` + `SameSite=Lax` |
| oss / h5（跨源静态托管） | `Authorization: Bearer` | access token 只存前端内存 | 禁 localStorage 落 token；CORS 白名单 |

- access 短时效（默认 15m），refresh 7d 且**一次一用**（换发即作废旧 refresh）。
- 吊销在 Redis：`jwt:rt:<member>:<jti>`（refresh 白名单）、`jwt:rev:<jti>`（access 拉黑到自然过期）。
- 改密 → 清该会员全部 refresh 会话（全端下线）。
- 口令算法 **argon2id**（64MiB / t=3 / p=1）；旧无盐 MD5 只做兼容校验，通过后强制改密并升级。
- 失败锁定：连续 5 次失败锁 15 分钟。

## 3. 默认拒绝与权限模型

- **全局 Guard 默认拒绝**，只有 `@Public()` 放行（健康检查、登录、回调）。旧系统"鉴权被注释掉、可自升 isadmin、IDOR 遍地"由此拦住。
- 权限是**权限码**（`permission.code`），不是布尔位：`exhibitor.read`、`contract.approve`、`financial.lock.toggle`、`export.pii` 等。取代旧 `auth1~10` 与"一个 `auth4` 通吃"。
- 数据范围是独立一维：`data_scope(member/role × show × hall)`，取代旧 `hall01~20` 布尔列。
- 两者都要过：`JwtAuthGuard` → `PermissionGuard`（`@RequirePermission` / `@RequireDataScope`）。
- 资源归属校验在 service 层做（展商只能写自己；员工按届次×展馆裁剪），不依赖前端传参可信。

## 4. 错误响应

- 沿用 Nest 默认结构：`{ statusCode, message, error }`；`message` 用**稳定机器码**而非中文句子，便于前端分支：
  `AUTH_MISSING` / `TOKEN_INVALID` / `TOKEN_REVOKED` / `BAD_CREDENTIALS` / `ACCOUNT_LOCKED` / `ACCOUNT_DISABLED` / `PERMISSION_DENIED:<codes>` / `DATA_SCOPE_DENIED:<level>`。
- 校验失败由全局 `ValidationPipe`（`whitelist` + `forbidNonWhitelisted` + `transform`）统一产出。
- 不新增自定义异常包装层，除非要携带结构化附加字段。

## 5. 分页与列表

- 统一 `page`（1 起）/ `pageSize`，响应 `{ items, total, page, pageSize }`。
- **禁止**旧系统 `query_pagination(任意表名)` 式的泛化查询接口（匿名拖库通道 S2）。
  对外只读查询必须走 `query_registry` 白名单：登记可查对象、字段、谓词，配 API Key + 限流。

## 6. 写操作纪律

- 高危动作（锁款/解锁、作废、批量重建、导出含 PII）必须：POST + 权限码 + 二次确认 + 审计流水。旧系统 GET 即 `TRUNCATE` 六表的形态一律不允许。
- 幂等：导入与跑批按业务键 upsert；ETL 脚本一律要求**幂等可续跑**。
- 状态跃迁一律写 `exhibitor_stage_log` / `approval_history`（只追加），记录 actor / reason / source，取代"没人知道谁改的"静默位。

## 7. 可观测

- `nestjs-pino` 结构化日志；`authorization` 与 `cookie` 头强制 redact。
- 审计落 `audit_log`，并保留 `legacy_table` / `legacy_pk` / `sql_kind` / `payload` —— 用于切换日冻结窗的**回补重放**（`plans/05` §8 铁规三）。
- 错误告警走钉钉群机器人；日志接 SLS。

## 8. 性能门禁（上线前必须过，`plans/05` §4.1）

1. 事件循环 lag 基线（预登记提交、AI 翻译两场景），阈值 100ms 告警。
2. 开展前压测三场景：预登记峰值 / 短信 OTP 峰值 / 现场核销峰值，报告归档。
3. worker 内存上限与自动重启演练。
4. 常设：`UV_THREADPOOL_SIZE=8`；PG 连接池 ≤ `max_connections` 60%；大文件一律流式；代码规约禁同步 fs 与大 JSON 序列化。

## 9. 契约生成

- 语义变更顺序：`docs/api/*.md` → `prisma/schema.prisma` → `pnpm openapi:export` → 前端 `pnpm contract:sync`。
- `openapi.json` 变更必须与代码同 commit；CI 用 `git diff --exit-code` 做 breaking 门禁。
- 前端不得手写 interface 或修改生成物。
