import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 标记路由为公开访问（健康检查/登录/回调等）——全局 Guard 默认拒绝的放行白名单 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
