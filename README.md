# print-v2 · api

广东大印展（PRINT CHINA）官网与业务系统改造的**服务端仓**：NestJS 10 模块化单体 + Prisma + PostgreSQL 16 目标（开发库现为 PG 18.6）+ BullMQ worker。

承担三件事：全部服务端 API（鉴权/限流/审计/归属校验）、8 域新模的数据迁移与清洗、契约快照的单向产出。

> 仓库规则、事实源顺序、编码边界与工作流约定统一见 [AGENTS.md](./AGENTS.md)。本文件只写概览、启动、脚本与部署入口。
> 前端仓在 `../web`；两仓独立 git，只通过 `openapi.json` 契约衔接。

## 目录概览

```text
.
├── apps/server              # NestJS API：/api/v1/*，全部服务端业务与鉴权
│   └── scripts/             # 应用内脚本（openapi 导出等，须留在 app 内才能解析依赖）
├── apps/worker              # BullMQ 消费者：导入/导出/报表/桥②桥③，与 server 同镜像分进程
├── prisma/
│   ├── schema.prisma        # 数据模型唯一真相源（8 域 + 平台基座）
│   ├── migrations/          # 迁移（含 legacy/etl schema 与部分唯一索引）
│   └── sql/                 # Prisma 表达不了的原生 SQL（部分唯一索引、开发库重置）
├── scripts/
│   ├── etl/                 # 五步法：load / recon / mapping / transform
│   ├── dev/                 # 隧道、冒烟验证、开发辅助脚本
│   └── deploy/              # Dockerfile、compose、nginx、云效流水线草稿
├── docs/
│   ├── api/                 # 业务语义事实源（状态机、字段含义、权限边界）
│   └── architecture/        # 架构说明（非事实源，背景参考）
├── notes/                   # 过程存档与接力（非事实源）
├── openapi.json             # 契约快照（CI breaking 门禁对象）
└── AGENTS.md                # 智能代理约束
```

## 前置条件

- Node.js `>= 26`（`engines` 已锁）、pnpm `>= 11`
- 数据库与 Redis 在远程 `ssh myserver` 的容器里，**本机不装、不留开发库**
- 必须先起 SSH 隧道（本项目固定 `15433 → myserver:5432`、`16379 → myserver:6379`；
  `15432` 已被其他项目占用，勿改回）

## 本地启动

```bash
# 0) 起隧道（另开一个终端常驻；脚本自带断线自动重连与端口冲突提示）
pnpm tunnel

# 1) 装依赖（原生构建白名单在 pnpm-workspace.yaml 的 allowBuilds）
pnpm install

# 2) 准备环境变量（凭据只进 .env，已在 .gitignore）
cp .env.example .env      # 然后填入开发库口令

# 3) 迁移与 Client
pnpm db:migrate           # = migrate deploy + db:indexes:ensure
npx prisma generate

# 4) 起服务
pnpm dev:server           # http://127.0.0.1:4000/api/v1
pnpm dev:worker           # BullMQ 消费进程
```

健康检查与访问点：

| 地址 | 说明 |
|---|---|
| `GET /api/v1/health` | 存活探针，返回 `{"status":"ok","db":"up","redis":"up"}` |
| `GET /api/v1/docs` | Swagger（仅非生产环境） |
| `POST /api/v1/auth/login` | 登录（argon2id；旧无盐 MD5 兼容校验 + 首登强制改密） |

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm tunnel` | 起 SSH 隧道（PG 15433 / Redis 16379） |
| `pnpm dev:server` / `pnpm dev:worker` | 启动 API / Worker |
| `pnpm build` | 构建全部 workspace |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | 静态检查与格式化 |
| `pnpm openapi:export` | 导出契约快照 `openapi.json`（前端类型的唯一来源） |
| `pnpm db:migrate` | `migrate deploy` + 自动补齐部分唯一索引 |
| `pnpm db:migrate:dev` | 开发期建迁移（同样自动补齐索引） |
| `pnpm db:indexes:ensure` | 幂等补齐 Prisma 无法声明的部分唯一索引 |
| `pnpm db:studio` | Prisma Studio 浏览数据 |
| `pnpm db:reset:dev` | 重置开发库 schema（仅限本项目库，绝不用于生产） |

## 数据迁移与验证脚本

```bash
node scripts/etl/load/load-sqldump.mjs --db <源库> --file <dump(.sql|.gz)> --baseline tmp-baselines/<源库>.rowcount
node scripts/etl/recon/profile-columns.mjs --limit 400 --top 20     # 列级脏数据画像
node scripts/etl/recon/scan-comma-digits.mjs                        # 千分位金额全列扫描
node scripts/etl/mapping/load-field-mapping.mjs                     # 字段映射入 etl.field_mapping
node scripts/etl/transform/import-staff.mjs                         # 真实员工账号归并
node scripts/etl/transform/transform-show.mjs [--dry-run]           # 届次域 transform（幂等）

node scripts/dev/smoke-schema.mjs    # 8 域规则验证（9 项断言）
node scripts/dev/smoke-auth.mjs      # 鉴权与 RBAC 验证（15 项断言，可连跑两轮）
```

迁移事实与结论存档在 `notes/`（01 取底盘点、02 待甲方确认清单、03 装载记录、04 数据质量、05 字段映射评审、06 实例拓扑修正、07 届次域记录）。

## 部署

- 三容器编排：`scripts/deploy/docker-compose.prod.yml`（portal / server / worker 同机起步）
- 镜像构建：`scripts/deploy/Dockerfile`（server 与 worker 共用一个镜像，compose 以 command 分进程）
- 反向代理与 301：`scripts/deploy/nginx.conf.example`（`/pc/` 为并行期桥①反代）
- 云效流水线草稿：`scripts/deploy/flow-pipeline-api.yml`（正式流水线需在云效控制台按 schema 校正）
- 上线前置门禁：事件循环 lag 基线、开展前三场景压测、worker 内存上限与自动重启演练（见 `plans/05` §4.1）
