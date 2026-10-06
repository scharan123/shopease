# ============================================================
# ShopEase Admin Dashboard — Production Dockerfile
# React + Vite SPA served by nginx
# Deployed individually on Render as a Web Service
# ============================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests first for Docker layer caching
COPY package*.json ./

# Install ALL deps (including devDeps needed for build)
RUN npm ci

# Copy source
COPY . .

# Build for production
# VITE_API_URL must be set at build time via Render environment variables
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Stage 2: Serve with nginx ----
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our production nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built dist from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Fix permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
