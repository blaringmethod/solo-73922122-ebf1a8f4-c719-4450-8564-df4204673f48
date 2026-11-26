# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# 先拷依赖清单，充分利用层缓存（显式包含 devDependencies，构建需要 tsc/vite）
# e2e 用的 playwright 无需在镜像内下载浏览器
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# 拷贝源码并构建（含 tsc 类型检查与 vite build）
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine AS runtime

# SPA 静态服务配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
