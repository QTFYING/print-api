#!/usr/bin/env bash
# ============================================================
# 开发期 SSH 隧道：本机 15433 -> myserver:5433(postgresql 共享容器（本项目库 pte_platform_dev）) / 16379 -> myserver:6379(Redis8 容器)
# 用法：pnpm tunnel   （或 bash scripts/dev/tunnel.sh [ssh主机别名，默认 myserver]）
# 凭据不落库不进 git：库密码见 api/.env（gitignore）；主机别名在 ~/.ssh/config
# ============================================================
set -euo pipefail
HOST="${1:-myserver}"

echo "[tunnel] forwarding 127.0.0.1:15433 -> ${HOST}:5433 (postgresql 共享实例)"
echo "[tunnel] forwarding 127.0.0.1:16379 -> ${HOST}:6379 (Redis)"
echo "[tunnel] Ctrl+C 断开；连接被远端 reset 时自动重连"

# 开发库在远端，隧道必须自愈：断线后指数退避重连（上限 30s）
delay=2
while true; do
  ssh -N \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=4 \
    -o ConnectTimeout=15 \
    -L 15433:127.0.0.1:5432 \
    -L 16379:127.0.0.1:6379 \
    "$HOST"
  code=$?
  # 端口被人占用（ExitOnForwardFailure）属于配置问题，不重试
  if [ "$code" -eq 0 ]; then
    echo "[tunnel] 正常退出"; break
  fi
  echo "[tunnel] 断开（exit=$code），${delay}s 后重连…"
  sleep "$delay"
  delay=$(( delay * 2 )); [ "$delay" -gt 30 ] && delay=30
done
