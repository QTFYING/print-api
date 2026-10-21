# 契约流（api → web 单向）

> 状态：现行。本文件是背景说明，规则本身以两仓 `AGENTS.md` 为准。

## 一条链

```
prisma/schema.prisma            数据模型唯一真相源（只存在于 api 仓）
      ↓ 实现
apps/server  + Nest Swagger     DTO / 校验 / 响应结构
      ↓ pnpm openapi:export
api/openapi.json                契约快照，与代码同 commit
      ↓ 前端 pnpm contract:sync
web/packages/types/openapi.json + src/schema.d.ts   生成物，禁手改
      ↓ 消费
apps/portal · apps/oss · apps/h5
```

## 三条硬规矩

1. **单向**。前端不得反向推动接口改义；发现契约问题回 api 仓改 `docs/api` → schema → 重导出。
2. **生成物不可手写**。`packages/types` 下类型只能由 `contract:sync` 产生；前端禁止手写 interface、禁止改生成物（ESLint 已豁免该目录以免误报，不代表可改）。
3. **breaking 门禁**。CI 导出后 `git diff --exit-code openapi.json`：契约变更必须与代码同 commit 提交，否则视为漂移。

## 为什么两仓分开

- 部署形态不同：api 是容器镜像滚动；oss/h5 是静态产物上 OSS+CDN；portal 是 Next 镜像。三条流水线独立。
- 权限边界不同：oss/h5 跨源走 Bearer，portal 同域走 httpOnly Cookie。
- 真相源唯一：Prisma schema 与迁移只在 api 仓，避免两处建模漂移。

## 同步命令

```bash
# api 侧
pnpm openapi:export                 # 生成 api/openapi.json

# web 侧（同机默认取 ../api/openapi.json；CI 用 API_OPENAPI_PATH 指定制品）
pnpm contract:sync                  # 拷贝快照 + 生成 @pte/types
```

## 已知边界

- 契约链目前只保证**结构**一致；**语义**一致要靠 `api/docs/api/*.md` 与前端只读镜像 `web/docs/api/`。
- 前端仓的 `docs/api/` 是从服务端仓复制的只读镜像，同步时只允许覆盖镜像文件，不得覆盖前端自己的 `shared/api`、`repositories`、`hooks`、`pages`、`README/AGENTS/CONVENTIONS`、`.codex/skills`。
