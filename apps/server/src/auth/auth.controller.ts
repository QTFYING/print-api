import { Body, Controller, Get, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, RequirePermission, type AuthedUser } from './auth.decorators';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 同域（portal）落 httpOnly Cookie；跨源（oss/h5）只回 Bearer，前端存内存 */
  private setPortalCookie(res: Response, token: string, ttlSeconds: number, refresh: string, refreshTtl: number) {
    res.append(
      'Set-Cookie',
      `pte_at=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`,
    );
    res.append(
      'Set-Cookie',
      `pte_rt=${encodeURIComponent(refresh)}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=${refreshTtl}`,
    );
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '账号口令登录（旧 MD5 兼容校验 + 首登强制改密）' })
  async login(
    @Body() body: { identifier: string; password: string; channel?: 'portal' | 'oss' | 'h5' },
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(body.identifier, body.password);
    if ((body.channel ?? 'portal') === 'portal') {
      this.setPortalCookie(res, r.accessToken, r.accessTtl, r.refreshToken, r.refreshTtl);
    }
    // 口令策略：portal 走 Cookie 不回明文 token；跨源端由前端存内存（禁 localStorage）
    return {
      accessToken: body.channel === 'portal' || !body.channel ? undefined : r.accessToken,
      refreshToken: body.channel === 'portal' || !body.channel ? undefined : r.refreshToken,
      tokenType: 'Bearer',
      expiresIn: r.accessTtl,
      legacyPassword: r.legacyPassword,
      mustChangePassword: r.mustChangePassword,
      user: r.user,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '换发 access（refresh 一次一用）' })
  async refresh(@Body() body: { refreshToken?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromCookie = /pte_rt=([^;]+)/.exec(String(req.headers.cookie ?? ''))?.[1];
    const token = body.refreshToken ?? (fromCookie ? decodeURIComponent(fromCookie) : undefined);
    if (!token) return { error: 'REFRESH_MISSING' };
    const r = await this.auth.refresh(token);
    if (fromCookie) this.setPortalCookie(res, r.accessToken, r.accessTtl, r.refreshToken, r.refreshTtl);
    return { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresIn: r.accessTtl, user: r.user };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出：吊销 refresh 白名单 + access jti 拉黑' })
  async logout(
    @CurrentUser() user: AuthedUser,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.append('Set-Cookie', 'pte_at=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.append('Set-Cookie', 'pte_rt=; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=0');
    return this.auth.logout(user.id, user.jti, body?.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前主体：身份 / 权限码 / 展馆数据范围' })
  me(@CurrentUser() user: AuthedUser) {
    return user;
  }

  @Patch('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: '改密（argon2id 升级 + 全端下线）' })
  changePassword(@CurrentUser() user: AuthedUser, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.auth.changePassword(user.id, body.oldPassword, body.newPassword);
  }

  /**
   * 默认拒绝验证端点：需权限码 probe.access。
   * 用途是自动化验证「未登录 401 / 无权限 403」这条 S6 防线真的生效（见 scripts/dev/smoke-auth.mjs）。
   */
  @Get('probe')
  @ApiBearerAuth()
  @RequirePermission('probe.access')
  probe(@CurrentUser() user: AuthedUser) {
    return { ok: true, who: user.id, permissions: user.permissions.length };
  }
}
