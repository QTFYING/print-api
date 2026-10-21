import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // 全站统一前缀：Nginx /api/v1/* → server（plans/05 §3.1）
  app.setGlobalPrefix('api/v1');

  // CORS 白名单来自配置；portal 同域 Cookie / oss+h5 跨源 Bearer（v1.4 分域）
  app.enableCors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // 契约快照（web 仓唯一类型来源）开发期可视化；CI 导出走 scripts/openapi/export-openapi.ts
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PTE Platform API')
      .setDescription('printchina 官网与办公系统升级 — 业务中台契约（web 仓全部应用无条件遵循）')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}

void bootstrap();
