/**
 * 契约导出：Nest + Swagger 生成 openapi.json（web 仓 packages/types 唯一来源）。
 * 位置在 apps/server 内：保证 @nestjs/* 依赖按 pnpm 工作区边界正确解析。
 * CI 门禁：导出后 git diff --exit-code openapi.json —— 契约变更必须与代码同 commit（breaking change 门禁）。
 * 离线运行：PRISMA_NO_CONNECT=1 跳过 DB 连接（Swagger 内省不需要真实连接）。
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

process.env.PRISMA_NO_CONNECT = '1';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('PTE Platform API')
    .setDescription(
      'printchina 官网与办公系统升级 — 业务中台契约。web 仓全部应用无条件遵循本契约，禁手写 interface、禁改生成物。',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: false });
  const outPath = join(__dirname, '..', '..', '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2) + '\n');
  console.log(`openapi.json exported -> ${outPath}`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
