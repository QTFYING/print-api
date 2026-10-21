import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

/**
 * 口令服务（plans/05 §9 S7 对策）：
 *   - 新口令一律 argon2id（取代无盐 MD5 / 默认弱口令 / 明文邮件重置）
 *   - 旧 MD5 兼容校验：展商/员工首登用旧哈希验通过后，强制改密并升级为 argon2id
 */
@Injectable()
export class PasswordService {
  private readonly argon2Options = {
    type: argon2.argon2id,
    memoryCost: 64 * 1024, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  };

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.argon2Options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    if (!hash) return false;
    if (hash.startsWith('$argon2')) {
      return argon2.verify(hash, plain).catch(() => false);
    }
    // 无盐 MD5（itma_pas / expo_admin.pass）：定长比较，避免时序侧信道
    const md5 = createHash('md5').update(plain, 'utf8').digest('hex');
    const a = Buffer.from(md5, 'hex');
    const b = Buffer.from(hash.slice(0, 32), 'hex');
    // 注意：32 个 hex 字符转 Buffer 是 16 字节，别拿字节数和 32 比（曾因此 MD5 分支恒 false）
    return a.length === 16 && b.length === 16 && timingSafeEqual(a, b);
  }

  /** 是否需要升级哈希（旧算法或首登强制改密） */
  needsUpgrade(algorithm: string | null, hash: string | null): boolean {
    if (!hash) return true;
    return algorithm !== 'ARGON2ID';
  }

  randomResetToken(): string {
    return randomBytes(24).toString('hex');
  }

  assertStrength(plain: string): void {
    // 弱口令策略：长度 >=10 且至少三类字符（旧系统重置固定 123456 是🔴级风险）
    const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(plain)).length;
    if (plain.length < 10 || kinds < 3) {
      throw new BadRequestException('PASSWORD_TOO_WEAK: 至少 10 位且含三类字符');
    }
  }
}
