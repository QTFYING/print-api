import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PasswordAlgorithm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /** 组装登录主体：身份 + 权限码 + 数据范围（Guard 每请求一次查库，M1 后加 Redis 缓存） */
  async buildUser(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        identities: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        dataScopes: true,
      },
    });
    if (!m || m.status !== 'ACTIVE') return null;
    return {
      id: m.id,
      jti: '',
      channel: 'bearer' as const,
      displayName: m.displayName,
      kinds: m.identities.map((i) => i.kind),
      permissions: [...new Set(m.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)))],
      scopes: m.dataScopes.map((s) => ({ showId: s.showId, hallId: s.hallId, level: s.level })),
      mustChangePassword: m.mustChangePassword,
    };
  }

  async login(identifier: string, password: string) {
    const m = await this.prisma.member.findFirst({
      where: { OR: [{ email: identifier }, { mobile: identifier }] },
    });
    if (!m) throw new UnauthorizedException('BAD_CREDENTIALS');
    if (m.lockedUntil && m.lockedUntil > new Date()) throw new UnauthorizedException('ACCOUNT_LOCKED');
    if (m.status !== 'ACTIVE') throw new UnauthorizedException('ACCOUNT_DISABLED');

    const ok = await this.passwords.verify(m.passwordHash ?? '', password);
    if (!ok) {
      const failed = m.failedLoginCount + 1;
      await this.prisma.member.update({
        where: { id: m.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : m.lockedUntil,
        },
      });
      await this.audit(m.id, 'LOGIN_FAIL', m.id);
      throw new UnauthorizedException(failed >= MAX_FAILED ? 'ACCOUNT_LOCKED' : 'BAD_CREDENTIALS');
    }

    // 旧无盐 MD5 通过 → 强制改密并升级算法（§7 展商登录归一策略）
    const isLegacy = m.hashAlgorithm !== PasswordAlgorithm.ARGON2ID;
    await this.prisma.member.update({
      where: { id: m.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), mustChangePassword: m.mustChangePassword || isLegacy },
    });
    await this.audit(m.id, 'LOGIN', m.id);
    const issued = await this.tokens.issue(m.id);
    const user = await this.buildUser(m.id);
    return { ...issued, user, legacyPassword: isLegacy, mustChangePassword: m.mustChangePassword || isLegacy };
  }

  async refresh(refreshToken: string) {
    const p = await this.tokens.verifyRefresh(refreshToken);
    const user = await this.buildUser(p.sub);
    if (!user) throw new UnauthorizedException('ACCOUNT_GONE');
    await this.tokens.revoke(p.sub, undefined, p.jti); // 轮换：旧 refresh 一次一用
    return { ...(await this.tokens.issue(p.sub)), user };
  }

  async logout(memberId: string, accessJti: string, refreshToken?: string) {
    let refreshJti: string | undefined;
    if (refreshToken) {
      try {
        refreshJti = (await this.tokens.verifyRefresh(refreshToken)).jti;
      } catch {
        refreshJti = undefined;
      }
    }
    await this.tokens.revoke(memberId, accessJti, refreshJti, 900);
    await this.audit(memberId, 'LOGOUT', memberId);
    return { ok: true };
  }

  /** 改密：升级 argon2id + 全端下线（旧明文邮件重置的替代路径） */
  async changePassword(memberId: string, oldPassword: string, newPassword: string) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m) throw new UnauthorizedException('ACCOUNT_GONE');
    if (m.passwordHash && !(await this.passwords.verify(m.passwordHash, oldPassword))) {
      throw new UnauthorizedException('BAD_CREDENTIALS');
    }
    this.passwords.assertStrength(newPassword);
    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        hashAlgorithm: PasswordAlgorithm.ARGON2ID,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    await this.tokens.revokeAllSessions(memberId);
    await this.audit(memberId, 'PASSWORD_CHANGE', memberId);
    this.logger.log(`会员口令已升级为 argon2id 并全端下线: ${memberId}`);
    return { ok: true };
  }

  private audit(actorId: string, action: string, targetId: string) {
    return this.prisma.auditLog
      .create({ data: { actorId, actorKind: 'STAFF', action, targetKind: 'MEMBER', targetId } })
      .catch(() => undefined);
  }
}
