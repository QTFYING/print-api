/** DI token：共享 ioredis 客户端（会话吊销/限流/验证码；BullMQ 连接由 worker 侧派生） */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
