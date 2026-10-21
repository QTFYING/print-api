import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { TokenService } from '../token.service';
import { AuthService } from '../auth.service';
import type { AuthedUser } from '../auth.decorators';

/** 从 Cookie 或 Bearer 头取 access token（双通道，plans/05 v1.4） */
function extractToken(req: { headers: Record<string, unknown>; cookies?: Record<string, string> }): {
  token?: string;
  channel: 'cookie' | 'bearer';
} {
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return { token: auth.slice(7), channel: 'bearer' };
  }
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader === 'string') {
    const hit = /(?:^|;\s*)pte_at=([^;]+)/.exec(cookieHeader);
    if (hit) return { token: decodeURIComponent(hit[1]), channel: 'cookie' };
  }
  const c = (req as { cookies?: Record<string, string> }).cookies?.pte_at;
  return c ? { token: c, channel: 'cookie' } : { channel: 'bearer' };
}

/**
 * 全局默认拒绝 Guard（§9 S6 对策）：
 *   旧系统「鉴权代码被注释掉、可自升 isadmin、IDOR 遍地」在新栈里由这一道统一拦住。
 *   只有 @Public 放行；其余必须持有效 access token（含 Redis 吊销检查）。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const { token, channel } = extractToken(req);
    if (!token) throw new UnauthorizedException('AUTH_MISSING');

    const payload = await this.tokens.verifyAccess(token);
    const user = (await this.auth.buildUser(payload.sub)) as AuthedUser | null;
    if (!user) throw new UnauthorizedException('ACCOUNT_GONE');

    req.user = { ...user, jti: payload.jti, channel };
    return true;
  }
}
