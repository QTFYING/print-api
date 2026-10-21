import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

/**
 * Redis 接入点：会话吊销表/限流/验证码/任务锁（plans/05 §3.1）。
 * lazyConnect：契约导出等离线场景不触发连接；首条命令自动连。
 * maxRetriesPerRequest=null：与 BullMQ 连接要求对齐。
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cs: ConfigService) =>
        new Redis(cs.getOrThrow<string>('redisUrl'), {
          lazyConnect: true,
          maxRetriesPerRequest: null,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
