// 与 apps/server/src/config/configuration.ts 保持同构；抽公共包在 M1 一并收敛
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  // worker 内存上限 + 自动重启演练为上线门禁（plans/05 §4.1 性能门禁③）
  memoryLimitMb: parseInt(process.env.WORKER_MEMORY_LIMIT_MB ?? '768', 10),
});
