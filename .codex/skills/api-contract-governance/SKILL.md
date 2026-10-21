---
name: api-contract-governance
description: 契约治理：改接口、DTO、响应结构、枚举或 openapi 快照时使用，保证 schema → Swagger → openapi.json → 前端生成物这条链不漂移
---

# 契约治理

## 适用场景

- 新增或修改 controller 的入参、出参、状态码、错误码
- 改 DTO、校验规则、分页包装、nullable
- 改枚举或业务状态值并对外暴露
- 前端反馈"类型对不上"或"字段含义不清"

## 全局规则入口

仓库事实源顺序与同步规则以 `AGENTS.md` 第 3、7 节为准，本 skill 只补专项动作，不覆盖它。

## 专项补充

1. **语义与结构分开处理**。改语义（字段含义、状态流转、权限边界）必须先改 `docs/api/*.md`；改结构（类型、可选性、包装）在语义不变前提下改 DTO/Swagger。反过来做等于用实现定义业务。
2. **`openapi.json` 是产物不是编辑对象**。任何手改 `openapi.json` 或前端 `packages/types` 生成物的行为都视为违规。
3. **breaking 变更要显式声明**。CI 用 `git diff --exit-code openapi.json` 拦漂移；确有 breaking 时，同一 commit 内同时提交代码、契约与迁移说明。
4. **错误码用稳定机器码**（`TOKEN_REVOKED`、`PERMISSION_DENIED:<codes>`），不用中文句子当分支条件。
5. **Swagger 不得反向推动接口改义**：它只描述传输结构与联调展示。
6. 能对齐时用编译期约束代替人工记忆：前端消费结构必须来自生成类型，不允许 `as` 伪装成契约。

## 必做顺序

1. 读 `docs/api/` 对应域文档，确认语义是否真要变。
2. 语义要变：先改 `docs/api/*.md`（含疑点编号），再改实现。
3. 结构要变：改 DTO/校验 → `pnpm typecheck` → `pnpm openapi:export`。
4. 前端侧执行 `pnpm contract:sync`，确认生成物 diff 与预期一致。
5. 收尾跑 `pnpm lint`、`pnpm format`，并在交付说明里写明验证项。
