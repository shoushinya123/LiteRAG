# ============================================================
# LiteRAG Dockerfile — 多阶段构建
# Stage 1: 编译原生依赖 + Next.js 构建
# Stage 2: 运行时精简镜像
#
# 使用 Debian-slim 基础镜像，避免 Alpine musl 导致的
# better-sqlite3 编译缓慢和兼容性问题。
# ============================================================

# ---- Stage 1: Build ----
FROM node:22-slim AS builder

# better-sqlite3 编译依赖（Debian 包名与 Alpine 不同）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖文件，利用 Docker 层缓存
COPY package.json package-lock.json ./

# 安装所有依赖（含 devDependencies，给 next build 用）
RUN npm ci

# 复制源码
COPY . .

# Next.js 构建
RUN npm run build

# 清理 devDependencies，只留生产依赖
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: Runtime ----
FROM node:22-slim AS runtime

WORKDIR /app

# 从 builder 复制生产依赖和构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./

# 数据目录（运行时通过 volume 挂载）
RUN mkdir -p /app/data

# 暴露 Next.js 默认端口
EXPOSE 3000

# 非 root 用户运行
RUN groupadd -r -g 1001 nodejs && \
    useradd -r -g nodejs -u 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

# 健康检查（slim 镜像自带 wget）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "node_modules/.bin/next", "start"]
