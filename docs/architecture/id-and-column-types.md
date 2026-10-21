# ID 与列类型约定（含一项待改型）

> 状态：**待拍板 D9**。本文件记录现状与代价，不代表已定稿。

## 现状（实测）

```
member_role.member_id      = text
member_identity.member_id  = text
staff_profile.member_id    = text
audit_log.actor_id         = text
legacy_account.member_id   = text
role_permission.role_id    = text
```

所有主键与外键在 PostgreSQL 里都是 **`text`，不是 `uuid`**。

## 成因

Prisma 里写的是：

```prisma
id String @id @default(uuid(7))
```

`@default(uuid(7))` 只决定**生成什么值**，不决定**列类型**；Prisma 的 `String` 默认映射 `text`，要拿到原生 `uuid` 必须显式加 `@db.Uuid`。

## 代价

1. 失去数据库层类型校验：写进空串、大小写混排、非 uuid 字符串都不会被拒，只会在应用层炸。
2. 索引与 join 效率低于原生 uuid（16 字节 vs text 变长 + 区域设置开销）。
3. PG 侧能力接不上：`gen_random_uuid()` 默认值、部分函数索引、跨库工具（pgloader/逻辑复制）对 uuid 更友好。
4. **已经在咬人**：ETL 脚本里 `= ANY($1::uuid[])` 全部报 `operator does not exist: text = uuid`，只能临时改成 `::text[]` 绕过。
5. 语义混淆风险：`text` 主键让"旧 id 字符串"与"新 uuid"在类型系统里无法区分。

## 建议

**在 8 域数据灌入之前改型。** 当前 `public` 里只有届次域 48 行（`show` 3 + `show_hall` 45）与 29 个员工账号，是最低成本窗口。做法：

```prisma
id String @id @default(uuid(7)) @db.Uuid
```

全量补 `@db.Uuid` 后生成一次迁移：

```sql
ALTER TABLE ... ALTER COLUMN id TYPE uuid USING id::uuid;   -- 主键与所有外键列
```

等展商域、财务域、观众域（十万行级）灌完再改，就是几十张表的类型转换 + 索引重建 + 停服窗口，成本陡增。

## 相关约定（不受改型影响，先定下来）

- 新模主键一律 uuid(7)（时间有序，利于索引局部性），**不用自增**：自增 id 会把展商数量等商业信息暴露在 URL 与导出文件名里。
- 旧系统主键不丢弃：一律进 `legacy_ref` / `legacy_account.external_id` / `hall_key` 之类的可回溯字段。
- 业务编号（`show.code`、`contract.contract_no`、`booth_no`）是**业务键不是主键**，参与复合唯一约束，但不当外键用。
- 金额一律 `NUMERIC(12,2)`（`@db.Decimal(12,2)`），禁止字符串存金额；币种与汇率快照字段随收款流水走。
- 存疑/未定语义字段统一进 `legacy_extra` JSONB + GIN（`jsonb_path_ops`），确认前可检索、确认后二次归位。
