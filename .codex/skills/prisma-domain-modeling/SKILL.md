---
name: prisma-domain-modeling
description: 改 prisma/schema.prisma、写迁移或需要 JSONB/GIN/部分唯一索引等 PG 特性时使用，规定 8 域建模口径与 Prisma 表达不了时的兜底方式
---

# Prisma 领域建模

## 适用场景

- 新增/修改模型、字段、索引、枚举
- 需要 GIN、trigram、部分唯一索引、物化视图
- 处理存疑列、届次 scope、软删与唯一性冲突

## 全局规则入口

`AGENTS.md` 第 3、5 节为准；列类型现状与待改型见 `docs/architecture/id-and-column-types.md`。

## 专项补充

1. **按域重建模，不照搬旧表**。88 张生效表 → 8 域语义模型；旧列名以 `///` 注释保留在字段上，保证可回溯。
2. **隐式状态机必须显式化**：`end01~end08` → `ExhibitorStage` 枚举 + `exhibitor_stage_log`（actor/reason/source）；`group_leader` → `BoothChangeRequest`；8 把区块锁 → `receivable_lock` 行式 + `LockBlock` 枚举。
3. **列名一律 snake_case**：所有标量字段补 `@map("...")`。否则 PG 里 camelCase 列在视图、物化视图、ETL 原生 SQL 里要满屏双引号。
4. **存疑列不跳过**：进 `legacy_extra Json @db.JsonB`，配 GIN；确认前可 `@>` 检索，确认后二次归位。零数据丢失是可验收项。
5. **索引能声明的一律声明进 schema**。Prisma 6 支持：
   ```prisma
   @@index([legacyExtra(ops: raw("jsonb_path_ops"))], type: Gin)
   @@index([companyNameCn(ops: raw("gin_trgm_ops"))], type: Gin)
   ```
   只在迁移 SQL 里手建的索引会被下次 `migrate dev` 当 drift 删除。
6. **带 `WHERE` 的部分唯一索引 Prisma 表达不了**：放 `prisma/sql/partial_unique_indexes.sql`，作为独立迁移段，并由 `pnpm db:indexes:ensure` 幂等补齐（`db:migrate` 已串联）。
   典型用途：`exhibitor (show_id, booth_no) WHERE booth_no IS NOT NULL AND deleted_at IS NULL`。
7. **迁移拆段有顺序**：扩展必须早于依赖它的索引（`0_init_extensions` → `baseline` → `partial_unique_indexes`）。
8. **绕开交互卡死**：建迁移优先用 `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel ... --script` 手工成段，再 `migrate deploy`；`migrate dev` 卡交互时会占 `pg_advisory_lock` 拖死后续 deploy。

## 必做顺序

1. 先读 `plans/05` §6 与对应 `docs/api/*.md`，确认语义与状态机。
2. 改 schema → `npx prisma validate` → `npx prisma format` → 再 validate 一次（format 会重排，锚点会变）。
3. 生成迁移段并**人工读一遍 diff**（确认没有误删索引/列）。
4. `pnpm db:migrate`（含 indexes ensure）→ `npx prisma generate`。
5. 跑 `node scripts/dev/smoke-schema.mjs` 验证规则真的生效，而不是"表建出来了"。
6. 有语义变化时同步 `docs/api/*.md` 与 `openapi.json`。
