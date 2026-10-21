import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QUEUES } from './queue-names';

/**
 * M0 冒烟样例消费者：证明 Redis 连通 + BullMQ 链路可用。
 * M1 起按 import/export/bridge2/bridge3/report 逐个落真实 Processor（重活一律在 worker，
 * server 事件循环零重计算 —— plans/05 §4.1 报表/导出/文档选型）。
 */
@Injectable()
export class SampleProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SampleProcessor.name);
  private worker?: Worker;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const connection = new Redis(this.config.getOrThrow<string>('redisUrl'), {
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker(
      QUEUES.SAMPLE,
      async (job) => {
        this.logger.log(`sample job #${job.id} processed: ${JSON.stringify(job.data)}`);
        return { ok: true };
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`sample job #${job?.id} failed: ${err.message}`);
    });
    this.logger.log(`BullMQ worker ready on queue "${QUEUES.SAMPLE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
