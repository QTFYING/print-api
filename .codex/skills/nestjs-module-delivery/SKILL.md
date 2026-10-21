---
name: nestjs-module-delivery
description: 在 apps/server 新增或改造 NestJS 模块（controller/service/domain/mapper/guard）时使用，规定分层落点、装配方式与最小验证
---

# NestJS 模块交付

## 适用场景

- 新增业务域模块（展商、合同审批、财务、观众、资料、会员）
- 给已有模块加接口、加守卫、加管道
- 拆分散落在 service 里的业务判断

## 全局规则入口

分层与编码边界以 `AGENTS.md` 第 5、6 节为准；本 skill 只补交付动作。

## 专项补充

1. **模块目录约定**：`src/<domain>/{<domain>.module.ts, controller, service, domain/, mapper/, dto/}`。
2. **domain 层纯净**：不得 import `@prisma/client`，不得用 Prisma 生成枚举做业务判断；输入业务枚举/领域快照，输出状态迁移结果。
3. **mapper 承担双向翻译**：Prisma enum ↔ 业务 enum 用闭集映射表（`Record<PrismaEnum, BizEnum>` 全量列举），新增枚举要触发编译期缺口而不是运行时 undefined。
4. **守卫顺序**：全局 `JwtAuthGuard` → `PermissionGuard`；单接口用 `@Public()` / `@RequirePermission()` / `@RequireDataScope()` 表达，不在 controller 内手写 if 判断。
5. **事务边界在 service**：跨表一致性动作（生成合同 + 置 stage + 写 stage_log）必须同一事务；worker 里的长任务用 BullMQ job 分步，不塞进 HTTP 请求。
6. **文件体量**：`.ts` ≤ 500 行、`*.service.ts` ≤ 400 行；触及超标文件时先拆本次相关的层，不继续堆职责。
7. **注释口径**：与 `constructor` 同级的方法都要中文说明职责/边界/副作用，1–2 行用 `//`，超过用 `/** */`，行尾不带句号。

## 必做顺序

1. 先读该域 `docs/api/*.md` 与 `prisma/schema.prisma` 对应模型。
2. 明确本模块只做什么、不做什么（跨域改动拆开）。
3. 写 domain 规则与 mapper，再写 service 编排，最后 controller。
4. 补 DTO 与 Swagger 装饰器 → `pnpm typecheck`。
5. 涉及运行链路：`pnpm dev:server` 后打 `/api/v1/health` 与该接口实测；有断言价值就加进 `scripts/dev/smoke-*.mjs`。
6. `pnpm openapi:export` 更新契约快照，与代码同 commit。
