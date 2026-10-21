import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../redis/redis.tokens';

/**
 * 双通道令牌（plans/05 §4.1 鉴权 + v1.4 托管分域）：
 *   - portal 同域：access token 走 httpOnly Cookie（SameSite=Lax）
 *   - oss / h5 跨源：Authorization: Bearer，access 只存前端内存，refresh 走 httpOnly Cookie
 *   - 禁用 localStorage 落 token；吊销表在 Redis（会话吊销 + refresh 白名单）
 */
export interface AccessPayload {
  sub: string;
  jti: string;
  typ: 'access';
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private get secret(): string {
    const s = this.config.get<string>('jwt.accessSecret');
    if (!s) throw new Error('JWT_ACCESS_SECRET 未配置');
    return s;
  }

  async issue(memberId: string): Promise<{ accessToken: string; refreshToken: string; accessTtl: number; refreshTtl: number }> {
    const accessTtl = this.config.get<string>('jwt.accessTtl') ?? '15m';
    const refreshTtl = this.config.get<string>('jwt.refreshTtl') ?? '7d';
    const atJti = randomUUID();
    const rtJti = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: memberId, jti: atJti, typ: 'access' } satisfies AccessPayload,
      { secret: this.secret, expiresIn: accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: memberId, jti: rtJti, typ: 'refresh' },
      { secret: this.secret, expiresIn: refreshTtl },
    );
    // refresh 白名单：只有 Redis 里存在的 jti 才可换发（登出/改密即可失效）
    await this.redis.set(`jwt:rt:${memberId}:${rtJti}`, '1', 'EX', this.ttlSeconds(refreshTtl));
    return { accessToken, refreshToken, accessTtl: this.ttlSeconds(accessTtl), refreshTtl: this.ttlSeconds(refreshTtl) };
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('TOKEN_INVALID');
    }
    if (payload.typ !== 'access') throw new UnauthorizedException('TOKEN_TYPE_WRONG');
    if (await this.redis.get(`jwt:rev:${payload.jti}`)) throw new UnauthorizedException('TOKEN_REVOKED');
    return payload;
  }

  async verifyRefresh(token: string): Promise<AccessPayload & { jti: string }> {
    let payload: { sub: string; jti: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('REFRESH_INVALID');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('REFRESH_TYPE_WRONG');
    const ok = await this.redis.get(`jwt:rt:${payload.sub}:${payload.jti}`);
    if (!ok) throw new UnauthorizedException('REFRESH_REVOKED');
    return payload as AccessPayload & { jti: string };
  }

  /** 登出：吊销 refresh 白名单 + 把当前 access 的 jti 拉黑到其自然过期 */
  async revoke(memberId: string, accessJti?: string, refreshJti?: string, accessLeftSeconds = 900): Promise<void> {
    const pipeline = this.redis.multi();
    if (refreshJti) pipeline.del(`jwt:rt:${memberId}:${refreshJti}`);
    if (accessJti) pipeline.set(`jwt:rev:${accessJti}`, '1', 'EX', Math.max(60, accessLeftSeconds));
    await pipeline.exec();
  }

  /** 改密后全端下线：清掉该会员所有 refresh 会话（access 靠短时效自然过期） */
  async revokeAllSessions(memberId: string): Promise<void> {
    const keys = await this.redis.keys(`jwt:rt:${memberId}:*`);
    if (keys.length) await this.redis.del(...keys);
  }

  private ttlSeconds(ttl: string): number {
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return Number(ttl) || 900;
    const n = Number(m[1]);
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
  }
}
