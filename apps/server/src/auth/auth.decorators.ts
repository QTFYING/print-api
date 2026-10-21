import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** 全局默认拒绝的放行白名单（健康检查、登录、回调） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'requiredPermissions';
/** 权限码（取代旧 auth1~10 / auth4 布尔位与 hall01~20 硬列） */
export const RequirePermission = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

export const DATA_SCOPE_KEY = 'dataScopeLevel';
/** 需要的数据权限级别：SHOW / HALL / PARTITION */
export const RequireDataScope = (level: 'SHOW' | 'HALL' | 'PARTITION') => SetMetadata(DATA_SCOPE_KEY, level);

export interface AuthedUser {
  id: string;
  jti: string;
  channel: 'cookie' | 'bearer';
  displayName: string | null;
  kinds: string[];
  permissions: string[];
  scopes: { showId: string | null; hallId: string | null; level: string }[];
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthedUser => {
  return ctx.switchToHttp().getRequest().user as AuthedUser;
});
