import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 唯一接入点（schema 只存在于 api 仓，plans/05 §5）。
 * PRISMA_NO_CONNECT=1 时跳过连接：openapi.json 契约导出等离线场景使用。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (process.env.PRISMA_NO_CONNECT === '1') return;
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
