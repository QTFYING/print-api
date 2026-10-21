---
name: show-scope-and-rbac
description: 涉及届次隔离、展馆数据权限、员工/展商身份边界或权限码增改时使用；本项目以「届次 × 展馆」替代多租户轴
---

# 届次 scope 与 RBAC

## 适用场景

- 任何列表查询、导出、批量操作
- 新增权限码或调整角色
- 展商自助端与员工后台的行为差异
- 判断某条数据"谁可以看、谁可以改"

## 全局规则入口

`AGENTS.md` 第 5、6 节与 `docs/api/api-architecture-overview.md` 第 2、3 节为准。

## 专项补充

1. **scope 轴是届次（`show_id`），不是租户**。本项目没有多租户概念；把 `show_id` 当 tenantId 用是常见误读。
2. **两维授权缺一不可**：
   - 功能维：`permission.code`（`exhibitor.read`、`contract.approve`、`financial.lock.toggle`、`export.pii`…）
   - 数据维：`data_scope(member/role × show_id × hall_id, level ∈ SHOW/HALL/PARTITION)`
3. **禁止沿用旧模型的布尔位**：`expo_admin.auth1~10`、单个 `auth4` 通吃、`hall01~20` 布尔列一律不得以新字段形式复活。
4. **届次 scope 强制到约束层**：业务表 `show_id NOT NULL`；查重/导出必须带届次。旧系统不带届次查重导致跨届串号（D3），已由部分唯一索引 + 冒烟断言根治。
5. **资源归属在 service 校验**，不信任前端传来的 id：展商只能读写自己 `member_identity(EXHIBITOR → exhibitor_id)` 关联的数据。
6. **身份归一**：`member` 一表三身份（VISITOR / EXHIBITOR / STAFF），旧 `expo_admin`、`pte_user`、`expo_order_login`、`itma_pas` 全部归并到 `member` + `legacy_account` 留档；旧无盐 MD5 只兼容校验，首登强制改密升级 argon2id。
7. **含 PII 的动作单独权限码**（`export.pii`），且导出必须走异步 job + 签名 URL（15 分钟）+ 7 天清理，展示层脱敏。

## 必做顺序

1. 明确动作属于哪一维：功能权限、数据范围，还是两者。
2. 查 `docs/api/` 对应域文档是否已定义该权限码；没有就先补文档再实现。
3. 实现：`@RequirePermission(...)` / `@RequireDataScope('HALL')` + service 内归属校验。
4. 查询条件必须显式带 `showId`（以及必要的 `hallId` 裁剪），不接受"前端没传就查全部"。
5. 验证：无 token → 401；有 token 无权限码 → 403；跨届数据不可见。加进 `scripts/dev/smoke-auth.mjs`。
