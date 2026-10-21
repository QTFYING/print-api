import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, DATA_SCOPE_KEY, type AuthedUser } from '../auth.decorators';

/**
 * RBAC + 展馆数据权限（§9：role × data_scope(届次×展馆) 两维显式授权，
 * 取代 expo_admin.hall01~20 布尔列 + auth4 一个位通吃）。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const need = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const scopeLevel = this.reflector.getAllAndOverride<'SHOW' | 'HALL' | 'PARTITION'>(DATA_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!need?.length && !scopeLevel) return true;

    const user = context.switchToHttp().getRequest().user as AuthedUser | undefined;
    if (!user) throw new ForbiddenException('NO_PRINCIPAL');

    if (need?.length) {
      const missing = need.filter((c) => !user.permissions.includes(c) && !user.permissions.includes('*'));
      if (missing.length) throw new ForbiddenException(`PERMISSION_DENIED: ${missing.join(',')}`);
    }
    if (scopeLevel) {
      const rank = { SHOW: 1, HALL: 2, PARTITION: 3 } as const;
      const granted = user.scopes.reduce((max, s) => Math.max(max, rank[(s.level as 'SHOW'|'HALL'|'PARTITION') ?? 'SHOW'] ?? 0), 0);
      if (granted < rank[scopeLevel]) throw new ForbiddenException(`DATA_SCOPE_DENIED: 需要 ${scopeLevel}`);
    }
    return true;
  }
}
