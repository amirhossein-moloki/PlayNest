# Stage 1: Base & Dependencies
FROM node:22-slim AS base

RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Install system dependencies needed for prisma and native modules (argon2/bcrypt/sharp)
RUN apt-get update && \
    apt-get install -y \
        openssl \
        python3 \
        make \
        g++ \
        libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Builder
FROM base AS builder

COPY package*.json ./
COPY prisma ./prisma/

# Configure npm for resilience
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 100000 && \
    npm config set fetch-retries 10

# Install all dependencies including devDependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npx prisma generate

COPY . .

# Build the application
RUN npm run build

# Remove development dependencies to keep the image slim
RUN npm prune --production

# Stage 3: Runtime
FROM node:22-slim AS runtime

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && \
    apt-get install -y \
        openssl \
        postgresql-client \
        libvips \
    && rm -rf /var/lib/apt/lists/*

# Copy build artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Ensure scripts are executable
RUN chmod +x scripts/*.sh

# Create storage directory for local media driver
RUN mkdir -p storage/media && chown -R appuser:appuser storage

USER appuser

EXPOSE 3000

# Use wait-for-db script by default in production
# The actual command will be overridden in docker-compose for flexibility
CMD ["./scripts/wait-for-db.sh", "db", "node", "dist/server.js"]
