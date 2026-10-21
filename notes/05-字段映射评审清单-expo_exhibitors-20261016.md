# 字段映射评审清单（expo_exhibitors，2026-10-16）

> 编制：高乐捷 FDE 交付团队　数据落点：myserver → `postgresql` → `pte_platform_dev` → `etl.field_mapping`
> 覆盖：**118 / 118 列，覆盖率 100%**（已登记 118、未覆盖 0）；其中 **103 列已定、18 列待甲方裁决**
> 复核命令：
> ```bash
> ssh myserver
> docker exec -it postgresql psql -U user_PcxZwh -d pte_platform_dev
>   select legacy_column, target_table, target_column, confidence, pending_ruling, left(semantic,60)
>     from etl.field_mapping where legacy_table='expo_exhibitors' order by pending_ruling desc, legacy_column;
> ```

---

## 一、对既有梳理文档（`docs/数据库表结构汇总.md` §B）的三处修正

| 项 | 文档原说法 | 副本实测结论 |
|---|---|---|
| 表宽 | 「编号列 45/55+ 已还原，约 8 成」 | 实际 **118 列**，其中 **23 列从未出现在 §B**；现已全部登记 |
| `itma02_1` 系列 | 笼统记为「上市国家/城市」 | 实为**三级**：`itma02_1_0`=国家（中英混存"中国"/"China"）、`itma02_1_1`=省代码（810000）、`itma02_1_2`=市代码（810100） |
| 附件列名 | `itma06_file_oname/_sname/_uptime` | 实际存在的是 `itma06_file_sname`（32 位 hex 存储名）与 **`itma06_fileuptime`**（无下划线），`_oname` 未在主表出现 |

另新增一个高价值发现：**`keywords` 列**（3,686/3,693 行有值、2,629 个不同值，样例 `2PRESS`、`龙运`）——这是展商搜索关键词，**B 档名录检索直接要用**，文档完全未记录。

## 二、需要改新模的地方（1 项）

- `exhibitor` 需增列 `search_keywords`（建议 `text[]` + GIN，或先 text 原样保 + 后续拆）。当前 schema v0 未包含，**待你确认后我加迁移**。

## 三、18 个待裁决列（分三类）

### A. 语义未明，暂入 `legacy_extra`（8 列）
`exhibitors015_6`、`exhibitors016_5`、`exhibitors016_a`、`exhibitors016_b`、`exhibitors019`、`exhibitors024_1`、`exhibitors024_3`、`exhibitors028`、`exhibitors033_1`、`exhibitors033_2`、`recycle`、`email_send`
→ 副本层已原样保真，**不阻塞导数**；确认后再二次归位。

### B. 名字与实测不符，需甲方澄清（2 列）
| 列 | 实测 | 疑问 |
|---|---|---|
| `payment1_note` | 3,693 行、仅 0/1 两值 | 名为"备注"实为标志位——是"定金已确认"之类的开关吗？ |
| `payment2_note` | 3,693 行、仅 0/1 两值 | 同上（余款） |

### C. 几乎无值但非全空，需确认历史用途（2 列）
`jiage01`（仅 1 行 =1700）、`jiage02`（仅 1 行 =1）→ 疑似价格/报价试验列，是否曾用于对外报价？

### D. 实测已判定「不迁」的死列（6 列，留档即可）
| 列 | 实测依据 |
|---|---|
| `enterprise_id` | 3,693 行全为 `0`（去重=1） |
| `itma_login` | 3,693 行全为 `0` |
| `shenhe` | 3,693 行全为 `0` → **主表审核位从未启用**，审核实际在 `expo_contract_approval(_node)` |
| `ident_date` | 3,693 行全为 `0000-00-00 00:00:00` → 死列，且属零日期脏数据 |
| `user_id` | 仅 46 行有值且全为 `0` |
| `jiage03/04/05`、`shenhe_yy`、`group_Remark`、`exhibitors001`、`exhibitors024_2`、`order_ident` | **全空（0 行有值）** |

> 说明：这些列虽不迁，但**必须先有实测才能下此结论**。此前它们与真正的存疑列混在一起，属于"未区分的不确定"。

## 四、金额清洗口径（已实测确认）

`expo_exhibitors_fenpeizw` 的 `ZWZJ / ZWDJ / ZWYK`（展位总价/定金/余款）在 2,631 行中分别有 **354 / 345 / 299 行带千分位**，样例 `357,984.00`、`107,395.20`、`250,588.80` → 证实 `plans/05` §2 的判断，清洗规则：

```sql
nullif(trim(x),'') |> replace(..., ',', '') |> ::numeric(12,2)
```

而 `exhibitors020_1`（展位费）3,683/3,693 行为空 → **主表这一列基本弃用，金额真值在 fenpeizw**，报表口径应据此复核。

## 五、下一步

1. 你确认是否给 `exhibitor` 加 `search_keywords` 列（我建议加，B 档名录检索要用）。
2. 其余 7 个域的映射按同样方法推进：以 §B/各模块文档为起点 → 副本实测补漏 → 覆盖率 100% 核查 → 待裁决清单。
3. 待裁决的 18 列已并入 `notes/02` 的 Q 系列，访谈时一次问完。
