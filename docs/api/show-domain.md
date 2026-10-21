# 届次域（show / show_hall）

> 取代旧对象：`expo_show`（177 列 × 3 行的横排列地狱）、`expo_bank`、`expo_party_info`。
> 数据来源：真生产 `8.148.188.249.printingexhibition` 的一次性只读副本 `legacy.pe__expo_show`。
> 实现基准：`prisma/schema.prisma` 的 `Show` / `ShowHall`；装载脚本 `scripts/etl/transform/transform-show.mjs`。

## 1. 范围

| 新表 | 旧来源 | 说明 |
|---|---|---|
| `show` | `expo_show` 单值列 | 届次主档，全局 scope 根 |
| `show_hall` | `expo_show` 的 `show008~show017_N` 横排列 | 物理展馆分区（层/连廊），摊平成行 |
| `bank_account` | `expo_bank` | 收款账户，`show.s_bankid` 指向 |
| `organizer_party` | `expo_party_info` | 甲方主体 + 收款账户 + 双 Word 模板路径 |

**不含**：`expo_exhibits_partition`。它虽被方案 §6.1 归入"展馆分区"，实测其 30 行内容是**展品品类分区**（数字印前 / 网印印花 / 印刷机械 / 标签印刷 / 瓦楞纸箱…），已改归资料/品类域处理（见第 6 节 D10）。

## 2. 字段映射（旧 → 新）

| 旧列 | 新列 | 实测样例（PC2027） |
|---|---|---|
| `show001` | `code` | `PC2027`，唯一，合同编号前缀（`show001-ZWH`） |
| `show002` | `name_cn` | 第六届中国（广东）国际印刷技术展览会 |
| `show003` | `name_en` | Print China 2027 |
| `show004` | `name_cn_abbr` | 第六届广东大印展 |
| `show005` / `show005_1` | `start_on` / `end_on` | 见 S1 疑点 |
| `show007` | `venue_name` | 广东现代国际展览中心（仅 PC2027 有值） |
| `all_pic` | `master_plan_url` | PC2027展馆规划图.jpg |
| 其余 27 列 | `legacy_extra` JSONB | `show_a1..show_e6`、`show018`、`jgyy_year`、`add_remarks`、`distribution` |

`show_hall` 摊平规则：

| 新列 | 来源 | 口径 |
|---|---|---|
| `name_cn` | `showNNN` / `showNNN_M` 的值 | 与 `show_id` 组成唯一键（同馆不同层/连廊是不同分区） |
| `hall_no` | 由名称解析 `/^(.+?馆)/` | 「4号A馆一层」→ `4号A馆`；当前 17/17 命中 |
| `hall_key` | 来源列名本身 | 如 `show017_4`，**保证每行可回溯到旧列** |
| `floor_plan_url` | `showNNN_pic` | 可为空 |
| `areas` JSONB | `_sq` / `_sq_a` / `_sq_b` / `_sq_c` | 键 `total/a/b/c` 原样保，语义见 S3 |
| `sort_order` | 列序 | 保持旧表展示顺序 |

## 3. 不变量

- `show.code` 全局唯一。
- **`is_current` 全局只能有一个 true** —— 由部分唯一索引 `show_current_uq` 保证（不是应用层约定）。当前为 PC2027。
- `show_hall (show_id, name_cn)` 唯一。
- 所有业务域表的 `show_id` NOT NULL 且参与复合唯一键（例：`exhibitor (show_id, booth_no)` 部分唯一，`booth_no IS NOT NULL AND deleted_at IS NULL`）。**跨届复用同一展位号必须允许**，这是旧系统 D3 漏洞的根治点，已由 `smoke-schema.mjs` 断言。

## 4. 派生规则

- `is_current`：取 `code` 最大者。届次初始化（2031 届）时应显式设置，不靠隐式推断（`plans/05` §14-1 要求届次初始化 runbook）。
- 展馆价区（`price_zone`，JGQY 2200/1700/1300 → A/B/C）**不在本届次域填充**：实测旧数据里价区挂在展商列 `exhibitors016_6` 与分区配置上，待展商域一并处理。

## 5. 待确认疑点（未答复前不得由实现单方面固化）

| # | 疑点 | 证据 | 若擅自处理的后果 |
|---|---|---|---|
| S1 | PC2027 闭展日期 `2027-06-16` | `show005=2027-04-12`、`show005_1=2027-06-16`，跨 65 天；`plans/05` §2 记为 4/12–16 | 展期是预登记倒计时、门票有效期、展馆租期共同基准，猜错即全线口径错 |
| S2 | 同列跨届语义漂移 | `show_a1`：PC2019=`30%`，PC2023/2027=日期 | 任何按这些列的报表必须分届实现，写通用 SQL 必错 |
| S3 | 面积四件套语义未定 | `_sq` 恒最大；`_sq_a/_sq_b/_sq_c` 关系未知 | 展位销售统计（`sp_get_tj_zwxs`）很可能依赖它们 |
| S4 | `show018` = 150000（逐届 120000→140000→150000） | 疑为总可租面积 | 影响可售面积口径 |
| S5 | `jgyy_year` PC2027 填 2026 | 与 `code` 不一致 | 疑为协会优惠适用年度，影响折扣计算 |
| S6 | 历届 `venue_name` 为空 | 仅 PC2027 有值 | 门户展示历史届会缺字段 |

## 6. 关联待拍板

- **D10 品类分区归属**：`expo_exhibits_partition`（30 行，带 `show_id`、`otb_yn/otb_kinds`）建议新建 `show_zone`，不并入 `product_category`（后者跨届复用，前者每届不同，混表会让品类检索出现同名词跨届混淆）。
- 连带纠正：展商域 `yxzg_id` 旧记"意向展馆"，实际指向品类分区 → 展商域 transform 时不得灌进 `hall_id`。

## 7. 验证方式

```bash
node scripts/etl/transform/transform-show.mjs --dry-run   # 预演
node scripts/etl/transform/transform-show.mjs             # 幂等执行
node scripts/dev/smoke-schema.mjs                         # 含跨届展位号唯一性断言
```

已验证：`show=3 / show_hall=45`；PC2027 的 94 个非空列逐列归类无漏网；连跑两次行数不变、重复分区 0；`is_current` 唯一。
