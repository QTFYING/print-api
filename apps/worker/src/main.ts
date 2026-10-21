import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/**
 * worker 常驻进程：与 server 同镜像，compose 以 command 分进程（plans/05 §3.1）。
 * 职责：BullMQ 消费（导入/导出/报表）、桥②名录同步、桥③预登记回流、文档转码（低频串行）。
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  // keep process alive
  await app.init();
}

void bootstrap();
