---
name: finance-and-lock-safety
description: 涉及收款、应收台账、区块锁、发票、退款押金、币种汇率、财务报表对账时使用；本项目最高风险链路
---

# 财务与区块锁安全

## 适用场景

- 收款/核销/入账/作废/退款任何写操作
- 区块锁加锁解锁
- 金额字段读写、汇总、导出
- 五张核心报表对账

## 全局规则入口

`AGENTS.md` 第 5 节；语义待补 `docs/api/finance-domain.md`（尚未编写，动手前先补文档）。

## 专项补充

1. **金额一律 `NUMERIC(12,2)`**，禁止字符串存金额。旧库 `expo_exhibitors_fenpeizw.ZWZJ/ZWDJ/ZWYK` 实测存在 `357,984.00` 这类带千分位字符串（54 列 / 12,966 行次），清洗规则：`nullif(trim(x),'') → replace(x,',','') → ::numeric(12,2)`。
2. **空串 ≠ 0**。`expo_financial_dues.dj_bffk` 1,095 行中 993 行是空串；空串一律 NULL，不得静默当 0 参与汇总。
3. **财务真实载体是 dues + 视图，不是流水表**：`expo_financial` 实测 **0 行**，`expo_bank_deposit` 1 行；应收/到款在 `expo_financial_dues`(1,095) + 视图 `v_get_expo_financial_dues_infolist`(3,701)。五张报表对账基准必须先与甲方书面确认（Q6），未确认前不启动对账。
4. **8 把区块锁显式化**：`receivable_lock(subject_type, subject_id, block, status, locked_at/by, unlocked_at/by/reason)`，`block` 用枚举取代旧 `lock1~5/31/a`（其中 lock31 内含 6/7、lock_a 内含 8，字段命名与区块错位，`lock2.php` 实际解的是 lock1）。
5. **加解锁必须是 POST + 权限码 + 二次确认 + 审计**；旧系统 GET 地址栏跳转、任何 auth4 可反复加解锁、无留痕、无并发控制，一律不得复刻。
6. **币种与汇率**：`payment_record` 带 `currency`、`exchange_rate`、`amount_cny`、`rate_snapshot`。**汇率快照取到账日还是录入日未定**（S 系列/Q6），未定前不得自行选一个。
7. **已知缺陷要"修复并出差异"，不是静默复刻**：旧派生列 `$inancial044` 拼写 bug 致押金 `f27/f28` 恒 0；迁移访谈时按现网数字请甲方裁决复刻或修复，默认修复并书面说明差异。
8. **导出不得互踩**：旧 `Summary` 导出用 `TRUNCATE expo_financial_temp` 全表互踩，一律改 BullMQ 按任务隔离的导出 job。
9. 任何金额相关判断（是否允许入账/核销/作废）走 domain 规则，不用 Prisma 枚举直接推。

## 必做顺序

1. 读现状数据（副本层）而不是读代码猜口径：`legacy.pe__expo_financial_dues`、视图 DDL 在 `etl.legacy_routine_ddl`。
2. 补 `docs/api/finance-domain.md` 语义与口径，标注未决项。
3. 实现：事务内原子判断 + 审计流水 + 锁状态校验。
4. 验证：金额汇总对账（Σ 新旧一致）、锁并发（两人同时操作不互相覆盖）、空串/千分位清洗用例。
5. 高风险改动先给实施计划再动手（`AGENTS.md` 9.1）。
