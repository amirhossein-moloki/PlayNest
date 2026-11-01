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
COPY templates ./templates

RUN pnpm i --frozen-lockfile

FROM base AS builder
WORKDIR /app
# Disable Husky during Docker build
ENV HUSKY=0
ENV NODE_ENV=production
ENV PAYLOAD_SECRET=build_time_payload_secret_32_characters_min
ENV PAYLOAD_CONFIG_PATH=/app/src/payload.config.ts
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN corepack enable pnpm

# Re-use dependencies and workspace packages from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/tools ./tools
COPY --from=deps /app/templates ./templates
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* turbo.json tsconfig.base.json tsconfig.json ./

# Copy application source code (excluding test/ and examples via .dockerignore)
COPY app ./app
COPY src ./src
COPY public ./public
COPY next.config.mjs ./
COPY instrumentation.ts ./
COPY payload-types.ts ./

ENV NEXT_TELEMETRY_DISABLED=1

# Build only the required packages for Payload headless API and Next.js app
# This avoids building all 41 packages (unused templates, DB adapters, live preview, UI, etc.)
RUN pnpm turbo build \
      --filter="payload..." \
      --filter="@payloadcms/next..." \
      --filter="@payloadcms/db-postgres..." \
      --filter="@payloadcms/email-nodemailer..." \
      --filter="@payloadcms/richtext-lexical..." \
      --filter="@payloadcms/transformer-sharp..." && \
    pnpm run build:app

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/src/docs ./src/docs
# Ensure media directory exists and is owned by nextjs
RUN mkdir -p /app/public/media && chown -R nextjs:nodejs /app/public/media

# Copy standalone build artifacts with non-root ownership directly
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/docs ./src/docs

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
