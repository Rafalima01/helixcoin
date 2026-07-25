# syntax=docker/dockerfile:1

# ---- deps: install dependencies only (cached separately from source) ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate Prisma client + build the Next.js app ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# `next build` imports src/server/config/env.ts (fail-fast env validation)
# while statically analyzing route modules, so the 5 vars with no `.default()`
# there must merely be *present* at build time — their real values come from
# docker-compose's `env_file: .env` at container run time and completely
# replace these build-only placeholders (Dockerfile ENV is stage-scoped and
# is overridden by runtime env either way). Never baked into the final
# `runner` stage — that stage starts fresh and only COPYs specific files.
ARG DATABASE_URL="postgresql://build:build@build:5432/build"
ARG REDIS_URL="redis://build:6379"
ARG JWT_ACCESS_SECRET="build-time-placeholder"
ARG JWT_REFRESH_SECRET="build-time-placeholder"
ARG ENCRYPTION_KEY="build-time-placeholder"
ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_URL=$REDIS_URL
ENV JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
ENV JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY

RUN npx prisma generate
RUN npm run build

# ---- runner: minimal production image, standalone Next.js output ----
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
