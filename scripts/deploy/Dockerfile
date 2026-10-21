# ============================================================
# api 仓唯一镜像（server/worker 同镜像，compose 以 command 分进程）—— plans/05 §3.1
# 阶段1 联调云效流水线③时校正（ACR 推送 / prisma migrate deploy 步骤）
# ============================================================
FROM node:26-alpine AS base
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma generate \
 && pnpm build

EXPOSE 4000
CMD ["node", "apps/server/dist/main.js"]
