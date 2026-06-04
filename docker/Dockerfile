# Stage 1: Build
FROM node:18-slim AS builder

WORKDIR /app

# Install dependencies needed for prisma and argon2/bcrypt
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Configure npm for better resilience against network issues
RUN npm config set fetch-retry-maxtimeout 600000 && \
    npm config set fetch-retry-mintimeout 100000 && \
    npm config set fetch-retries 10

# Use cache mount for npm and multiple retries for npm ci and prisma generate
# to handle transient network failures and speed up builds
RUN --mount=type=cache,target=/root/.npm \
    (npm ci || (sleep 5 && npm ci) || (sleep 10 && npm ci)) && \
    (npx prisma generate || (sleep 5 && npx prisma generate))

COPY . .

RUN npm run build

# Stage 2: Runtime
FROM node:18-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl postgresql-client && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN chmod +x scripts/*.sh

EXPOSE 3000

CMD ["node", "dist/server.js"]
