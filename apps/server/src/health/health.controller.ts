import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.tokens';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** 存活探针：PG + Redis 连通性（ECS/Nginx 健康检查与压测基线共用） */
  @Public()
  @Get()
  async check(): Promise<{ status: string; db: string; redis: string; ts: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    const redisPong = await this.redis.ping();
    return {
      status: 'ok',
      db: 'up',
      redis: redisPong === 'PONG' ? 'up' : 'degraded',
      ts: new Date().toISOString(),
    };
  }
}
