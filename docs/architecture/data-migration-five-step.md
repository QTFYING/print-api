# 数据迁移五步法（落地形态）

> 来源：`plans/05` §8。本文件写"在我们环境里怎么跑"，方案本身以 `plans/05` 为准。
> 目标：**每步可验收，禁止一把梭导入**。

## 三层结构

```
甲方生产 MySQL（8.148.188.249 业务 / 118.89.36.201 门户）
   │ ① 一次性只读取底（SELECT/SHOW/mysqldump，禁 DDL/DML）→ 此后永不再连
   ▼
pte_platform_dev · legacy schema   副本层：316 表 / 227,794 行，列一律 text，原样保真
   │ ②③④ 映射 / ETL / 对账（全在 PG 内做 SQL）
   ▼
pte_platform_dev · public schema   8 域新模 + 平台基座
pte_platform_dev · etl schema      过程台账（非事实源，但可复核）
```

## 为什么副本层全 `text`

MyISAM + 裸 PHP 的历史库里，int 列存空串、date 列存 `0000-00-00`、decimal 列存 `"357,984.00"` 都真实存在。保留类型会让 COPY 在第 N 万行炸掉且难定位。**先无损落地，脏数据在 transform 阶段处理并出体检报告**。

## 五步与出口标准

| 步 | 做什么 | 出口标准 | 已落地物 |
|---|---|---|---|
| 1 取底 | 甲方授权下一次性只读导出 | 表/视图/过程/函数/触发器数量与 `information_schema` 逐项相等；有 `-- Dump completed` 与 sha256；逐表 `COUNT(*)` 基线 | `/opt/pte-dump/*.sql.gz` + `.rowcount`；`notes/01`、`notes/06` |
| 2 语义映射 | 旧列 → 新列登记 | 每域**覆盖率 100%**，未定语义列全部标 pending 并进 `legacy_extra` | `etl.field_mapping`；`notes/05`（展商主表 118/118） |
| 3 ETL | 分域清洗装载 | 逐表行数与基线一致；脏数据体检报告 | `scripts/etl/load`、`recon`、`transform`；`notes/04` |
| 4 报表基线对账 | 现网五张报表数字 vs 新系统复算 | 差异归零或书面归因 + 甲方签字 | `etl.report_baseline`、`etl.recon_diff`（**待 Q6 答复后启动**） |
| 5 双轨灰度 | 名录同步桥②、回流桥③、按模块切流 | 切流清单签认 + 回退预案演练一次 | `audit_log.legacy_table/legacy_pk` 已备回补重放 |

## 四条纪律

1. **幂等可续跑**。远程隧道会被这台服务器随机 reset，装载脚本必须能中断后重跑且不产生重复：台账里行数已一致的表跳过，其余先 `DROP` 再建。
2. **流式解析与异步写库不得交织**。曾因此在同一文件上跑出两种行数。装载一律两阶段：先完整解析（确定性、可校验），再统一写库。
3. **零丢失可证明**。每域 transform 必须输出"旧表非空列 → 去向分类"的逐列归属，出现"未归类"即为漏项。
4. **不造业务样例数据**。副本层已有真实数据；工具自测件跑完即清并标注。

## 已知环境约束

- myserver 是 2C / 1.6GB 的共享练手机：**不放 MySQL 中继容器**，批量 ETL 与压测应在阶段1 的生产 ECS 或专用实例跑。
- `--tab` 导出不可用（远程连接时文件落在 DB 主机侧），因此走标准 SQL dump + 自研解析器。
- 真生产存在**中文命名存储过程**，`mysqldump --routines` 会因客户端字符集错配失败；例程/视图定义改从 `information_schema` 以文本导出，存 `etl.legacy_routine_ddl`。
