import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionGuard } from './auth/guards/permission.guard';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        pinoHttp: {
          level: cs.get('LOG_LEVEL', 'info'),
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie'],
            censor: '[REDACTED]',
          },
          ...(process.env.NODE_ENV !== 'production'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    // S6 对策（plans/05 §9）：全局默认拒绝 → @Public 放行；再叠加 RBAC + 展馆数据权限
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
