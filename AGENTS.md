# AGENTS.md

本文件定义 `print-v2/api` 对智能编码代理的默认约束。除非用户在当前任务中明确覆盖，进入本仓库即默认遵守。

优先级：**用户当前明确要求 > `AGENTS.md` > `docs/*` > 匹配任务的 `.codex/skills/*` > 其他局部说明**。

## 1. 语言

- 与用户沟通默认中文；仓库内新增或重写的说明性文档默认中文。
- 英文只用于代码、接口路径、枚举值、库名、命令与环境变量名。
- 交付物署名一律用 **高乐捷 FDE 交付团队**，不写个人姓名。

## 2. 全局约束入口

持续生效：

1. `AGENTS.md`（本文件）
2. `.codex/skills/*`
3. `docs/api/*.md`（业务语义事实源）
4. 工作区级 `~/.qwenworkcn/awareness/main/AGENTS.md`（数据库与开发环境铁律，跨项目生效）

`README.md` 只承载项目概览、启动、脚本与部署入口，不承载独立工程规则。

## 3. 事实源顺序

本项目是**改造与数据迁移**项目，事实源分三条链，不要互相冒充：

**业务语义链（改行为）**

1. `plans/05-技术方案-B档平台化-内部施工版-v1.md`（工作区外，权威方案，含 8 域建模与拍板记录）
2. `docs/api/*.md`（本仓业务语义：状态机、字段含义、权限边界）
3. `prisma/schema.prisma`（数据模型唯一真相源）
4. `openapi.json`（对外契约快照）
5. `apps/server` 实现代码

**数据迁移链（改数据）**

1. `legacy` schema 副本层（甲方生产库 1:1 原样，只读）
2. `notes/0[1-7]*.md`（取底结论、脏数据画像、字段映射评审、疑点清单）
3. `etl.*` 台账表（`dump_batch` / `legacy_recon` / `column_profile` / `field_mapping` / `legacy_routine_ddl` / `recon_diff`）
4. `scripts/etl/**`（可复现装载与核对脚本）

**契约链（前后端）**

`prisma/schema.prisma` → Nest Swagger → `pnpm openapi:export` → `openapi.json` → 前端 `pnpm contract:sync` 生成类型。单向，不可逆向手改。

补充口径：

- `schema.prisma` 只存在于本仓；`prisma/migrations` 是数据模型的可执行基准。
- `openapi.json` 是契约快照，变更必须与代码同 commit（CI 做 breaking 门禁）。
- Swagger/OpenAPI 只描述传输结构与联调展示，**不得反向推动接口改义**。
- 语义争议回溯按上述顺序取证；但并非所有变更都走同一固定链路：改语义走 `docs/api → schema → openapi`，改结构先确认 `docs/api` 语义不变。

## 4. 非事实源

`docs/architecture/`、`notes/`（含 `notes/handoffs/`）、`review/` 只作背景参考与过程留痕，**不作为编码事实源**；其中"疑点/待拍板"条目在得到甲方答复前，不得被实现代码单方面固化成结论。

## 5. 编码边界

- **不直连甲方生产库**（`8.148.188.249`、`118.89.36.201`）。一次性只读取底已完成，此后一切开发、ETL、对账只连 myserver 副本。详见工作区级铁律一。
- **`legacy` schema 只读**：原样保真、不改名、不改类型、不清洗；清洗只发生在写入 `public` 新模时。
- **不造业务样例数据**：验证映射与业务规则必须用真实迁移数据。工具自测件（`@smoke.local` 之类）必须跑完即清、明确标注为自测。
- **届次 scope 强制**：业务表按 `show_id` 隔离，查重与导出不得跨届（旧系统 D3 漏洞的根治点）。
- 状态机一致性、金额正确性、财务区块锁与审计留痕，高于"先把功能写出来"。
- 存疑字段一律进 `legacy_extra` JSONB（GIN 可检索），确认前不猜语义、确认后二次归位。
- 文件大小目标态：单个 `.ts` ≤ 500 行，`*.service.ts` ≤ 400 行；历史超标按增量治理，触及时不得继续堆入新职责。

## 6. 默认分层

- **controller** 只处理 HTTP 契约、参数校验、鉴权接入、响应组装。
- **service** 负责业务编排、事务边界、幂等收口与 domain 调用。
- **domain** 不得依赖 `@prisma/client`、不得使用 Prisma 生成枚举承载业务状态判断；接收业务枚举/领域快照，返回状态迁移结果。
- **mapper** 集中维护 Prisma 持久化结构与领域/契约结构的双向映射；Prisma enum 与业务 enum 用闭集映射表，新增枚举应触发编译期缺口。
- **Prisma 只承载持久化**：构造 `where/select/orderBy` 可用 Prisma 类型；判断"是否允许支付、核销、入账、作废、锁款"必须走 domain 规则或 mapper 转换后的业务枚举。
- `apps/worker` 只放消费与跑批；重活（导入、导出、报表、文档转码）一律在 worker，server 事件循环零重计算。
- 明显只服务单个业务域的 helper 留在该域内，不提前抽共享层。

## 7. 文档同步

- 改接口语义或状态机 → 查 `docs/api/*`、`schema.prisma` 注释、`openapi.json`。
- 改字段结构或响应包装 → 先确认 `docs/api` 语义不变，再重跑 `pnpm openapi:export` 并同步提交。
- 改数据模型 → `schema.prisma` + 迁移；**迁移后必须跑 `pnpm db:indexes:ensure`**（带 `WHERE` 的部分唯一索引 Prisma 表达不了，会被 drift 删掉）。
- 改迁移或清洗规则 → 同步 `notes/` 对应存档与 `etl.*` 台账口径说明。
- 改仓库级规则 → 查 `README.md`、本文件与相关 `.codex/skills/*`。

## 8. 默认动作

1. 先读 `README.md` 了解入口，再读本文件取仓库规则。
2. 涉及业务语义，读 `docs/api/*.md`；涉及数据迁移，读 `notes/0[1-7]` 与 `etl` 台账。
3. 必要时看 `schema.prisma`、`openapi.json`。
4. 最后看实现代码。

## 9. 工作流约定

### 9.1 通用规则

- 用户明确要求始终高于默认流程；要求"直接做/不要计划/不要测试"时优先服从。
- 不为工作流而工作流：单文件低风险修补、文案与注释同步可直接做，不强制先写长计划。
- 下列任务默认先给简短实施计划再动手：财务与区块锁、审批链、导入导出 ETL、鉴权与数据权限、Prisma 建模、跨模块重构、触及 `docs/api`/`schema.prisma`/`openapi.json` 同步的改动。
- 遇 Bug、回归、原因不明的偶发错误：**先收集现象、复现路径与代码/数据证据，再判断根因**，禁止跳过证据链猜测式修复。
  - 本项目已有两例教训：认证失败先查**端口归属与隧道落点**，不要反复轮换口令；判断实例新旧要看业务表时间戳，不要信 `information_schema.update_time`。
- 大范围修改前先说明触及的模块、事实源与验证方式；避免先改实现、后补文档、最后才发现语义冲突。
- 能验证时，完成前必须运行与结论直接相关的验证；不能运行时，必须写明未执行的验证项、停留状态与剩余风险。
- **没跑过验证的事不得写进"已完成"**。

### 9.2 章节式改造协作约定

适用于数据迁移、域 transform、模块拆分、技术债治理等可拆步任务。

- 先定章节目标，再拆 `T01`、`T02`… 小项：改动面小、目标单一、可独立审查、可独立回退。
- 每小项开工前说明改什么、不改什么、影响哪些文件；用户追加的限制或命名要求先吸收进本步。
- 只做当前小项，不顺手扩散到无关模块；边界不相干的改动不揉成一个提交。
- 最小验证口径：
  - 结构/装配调整 → `pnpm typecheck`
  - 运行链路与边界调整 → 加跑 `node scripts/dev/smoke-schema.mjs` / `node scripts/dev/smoke-auth.mjs`
  - 迁移与清洗 → 装载脚本必须**幂等可续跑**，并输出与生产基线的逐表对账结果
- `pnpm lint`、`pnpm format` 默认在章节收尾统一执行，不要求每个 `T0X` 重复跑。
- 触及 class 文件时，与 `constructor` 同级的方法都要补中文注释：1–2 行用 `//`，超过 2 行用 `/** ... */`；写职责、边界、语义与副作用，不写逐行翻译，**行尾不得出现中英文句号**。
- 纯 lint/format 收尾批次可不额外补业务注释。
- 默认在一个章节全部完成、验证通过、用户确认后再统一提交；提交信息遵循 conventional commits（husky commitlint 已启用），分支一律推 **master**。
- 跨会话/跨设备/换 AI 接力时，用 `work-handoff` skill 把状态写进 `notes/handoffs/YYYYMMDD-<主题>.md`，显式区分已完成、未完成、核心关注点、验证状态。

## 10. 当前有效 skills

1. `.codex/skills/api-contract-governance`
2. `.codex/skills/nestjs-module-delivery`
3. `.codex/skills/prisma-domain-modeling`
4. `.codex/skills/show-scope-and-rbac`
5. `.codex/skills/finance-and-lock-safety`
6. `.codex/skills/migration-etl-discipline`
7. `.codex/skills/project-quality-assurance`
8. `.codex/skills/dev-environment-recovery`
9. `.codex/skills/work-handoff`

任务明显匹配某 skill 时优先使用；skill 只承载专项流程，**不反向覆盖本文件**。
