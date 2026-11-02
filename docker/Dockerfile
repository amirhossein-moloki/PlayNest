# Stage 1: Base image
FROM node:22-slim AS base

WORKDIR /app

# Stage 2: Dependencies and Builder
FROM base AS builder

# Install OpenSSL needed for Prisma CLI engine generation
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

COPY sayra/package*.json ./
COPY sayra/prisma ./prisma/

# Configure npm for resilience
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 100000 && \
    npm config set fetch-retries 10

# Install dependencies and generate Prisma Client
# sharing=locked prevents concurrent cache corruption, npm cache verify purges broken cache entries
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm cache verify && \
    npm ci && \
    npx prisma generate

COPY sayra .

# Build the TypeScript application and copy static assets
RUN npm run build

# Remove development dependencies to keep the image slim
RUN npm prune --production

# Stage 3: Runtime
FROM base AS runtime

# Install only minimal runtime system dependencies (OpenSSL for Prisma engine, postgresql-client for wait-for-db.sh)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openssl \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Run application as a non-root system user
RUN groupadd -r appuser && \
    useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Copy build artifacts and production dependencies with non-root ownership directly
# This avoids running recursive 'chown -R' on OverlayFS, which causes duplicate layer storage and ENOSPC failures
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/src ./src
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/prisma ./prisma
COPY --from=builder --chown=appuser:appuser /app/scripts ./scripts

# Ensure scripts are executable
RUN chmod +x scripts/*.sh

# Create storage directory for local media driver with non-root write access
RUN mkdir -p storage/media && chown -R appuser:appuser storage

USER appuser

EXPOSE 3000

# Use wait-for-db script by default in production
CMD ["./scripts/wait-for-db.sh", "db", "node", "dist/server.js"]
