# ============================================================
# LiteRAG Dockerfile — 多阶段构建
# Stage 1: 编译原生依赖 (better-sqlite3)
# Stage 2: 运行时精简镜像
# ============================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

# better-sqlite3 编译依赖
RUN apk add --no-cache python3 make g++

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
FROM node:22-alpine AS runtime

# better-sqlite3 运行时需要的基本库
RUN apk add --no-cache libstdc++

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
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs && \
    chown -R nextjs:nodejs /app

USER nextjs

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "node_modules/.bin/next", "start"]
