# ============================================================
# ShopEase Backend — Production Dockerfile
# Deployed individually on Render as a Web Service
# ============================================================

# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package manifests first for layer caching
COPY package*.json ./

# Install ONLY production dependencies (skip devDependencies)
RUN npm ci --omit=dev

# ---- Stage 2: Final production image ----
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S shopease && adduser -S shopease -G shopease

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Remove any dev files that shouldn't be in production
RUN rm -rf .env.example *.md

# Own the files by the non-root user
RUN chown -R shopease:shopease /app
USER shopease

# Render assigns PORT via environment variable
EXPOSE 5000

# Health check so Render knows the service is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1

CMD ["node", "server.js"]
