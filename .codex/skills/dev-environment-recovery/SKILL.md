---
name: dev-environment-recovery
description: 连不上数据库、隧道断了、认证失败、后台进程没起来、远端连接被重置时使用；本项目开发环境的排障顺序
---

# 开发环境恢复

## 适用场景

- `P1001 Can't reach database server` / `P1000 Authentication failed`
- 服务端口没监听、后台进程"看起来没起来"
- 装载/长任务中途 `Connection terminated` / `ECONNREFUSED`

## 环境事实

| 项 | 值 |
|---|---|
| 本机 | Windows，**无 Docker、无 psql 客户端**，`/tmp` 不可用（临时文件放工作区） |
| 开发库 | `ssh myserver` → 容器 `postgresql`（postgres:18.6-alpine）→ 库 `pte_platform_dev` |
| Redis | 同机容器 `redis`（有 requirepass） |
| 隧道 | 本机 `15433 → myserver:5432`、`16379 → myserver:6379`（`pnpm tunnel`） |
| **端口雷区** | `15432` 被另一项目（golo-dev）的隧道长期占用，**与本项目无关，不要改回 15432** |
| 服务器 | 2C / 1.6GB / 共享，**会随机 reset 长连接** |

## 排障顺序（按这个来，别跳步）

1. **先验端口归属**：`netstat -ano | grep 15433` → 拿到 PID → 看它的命令行是不是我们的隧道（含 `myserver`）。
   今天最贵的一课：连续几天认证失败的真因是 `.env` 端口写成 15432，Prisma 一直连的是**另一台机器**。
2. **再验隧道存活**：`bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/15433"`。不通就重启隧道（脚本自带自动重连与端口冲突提示）。
3. **再验库侧身份**：容器内本地套接字不需要口令 ——
   `ssh myserver docker exec -i postgresql psql -U <超管> -d pte_platform_dev -tAc "select current_user, current_database()"`
   能连上说明库没问题，问题在凭据或路径。
4. **最后才怀疑口令**，且**只对齐一次**：把库侧口令设成凭据入口里的既有值，而不是反过来生成新口令再到处改。
   反复轮换会让 `.env` 与库两侧各说各话 —— 本项目因此失败过 4 次。
5. 凭据相关操作**只走前台原生 shell**，不把口令写进脚本文件、不打印、不进 git。

## 后台进程注意事项

- `nohup … &` 起的进程会随该次工具调用结束被回收；需要常驻的用后台任务方式起。
- Nest `bufferLogs: true` 时必须 `app.useLogger(app.get(Logger))`，否则日志全被吞，worker 看起来"没起来"。
- `nest start --watch` 的子进程要按端口找 PID 杀，别按进程名批量杀（会误伤同机其他项目）。
- pnpm 严格隔离下，monorepo 根目录脚本解析不到子应用依赖：脚本要放进对应 app（如 openapi 导出在 `apps/server/scripts/`）。

## 已排除的错误假设（别再走回头路）

- ❌ "有人改了我们的数据库账号" —— 未证实；实测真因是端口串台 + 自己改乱了口令。
- ❌ "共享实例不能放我们的库，必须另起容器" —— 结论下早了；库本身完好。
- ❌ 用 `information_schema.update_time` 判断实例新旧 —— 会骗人，要看业务表时间戳字段。
