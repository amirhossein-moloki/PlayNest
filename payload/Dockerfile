FROM node:24-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Disable Husky during Docker build
ENV HUSKY=0

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* turbo.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY tools ./tools
COPY test ./test
COPY templates ./templates

RUN pnpm i --frozen-lockfile

FROM base AS builder
WORKDIR /app
# Disable Husky during Docker build
ENV HUSKY=0
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=8192"

RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/tools ./tools
COPY --from=deps /app/test ./test
COPY --from=deps /app/templates ./templates
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build:all && pnpm run build:app

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
