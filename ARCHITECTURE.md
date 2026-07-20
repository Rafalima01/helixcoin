# HeliJump — Backend Architecture (Phase 2: Foundation)

This document covers the backend infrastructure built in Phase 2. It is
**infrastructure only** — no business rules for users, wallets, RTP,
affiliates, PIX, gateways, or the game live here. Phase 3+ builds one
business module at a time on top of this foundation, following the
convention in [`src/modules/_template`](src/modules/_template/README.md).

The Phase 1 admin backoffice mockup (`src/app/admin`) is unaffected — it
still runs entirely on mock data via `src/lib/admin/services.ts` and hasn't
been wired to this backend yet; that wiring is module-by-module, same as
everything else.

## Stack

Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Redis · BullMQ ·
Zod · JWT (`jose`) · bcrypt · React Query · Docker / Docker Compose.

## Layout

```
src/
  server/            backend foundation — see table below
  modules/
    _template/       working reference implementation of the module convention
  app/
    api/              Route Handlers — thin, delegate to modules/*/controllers
    api/health/        liveness
    api/health/ready/  readiness (checks Postgres + Redis)
    api/metrics/       Prometheus scrape target
    api/openapi.json/  OpenAPI spec (served for /docs)
    docs/              self-hosted Swagger UI
  lib/                pre-existing app-level utilities (unchanged)
scripts/
  worker.ts           BullMQ worker process entry point
  ws-server.ts        WebSocket server process entry point
tests/
  unit/server/**      mirrors src/server/**
  helpers/            test-double conventions
prisma/
  schema.prisma       PostgreSQL, UUID PKs, AuditLog + Role infra models
  migrations/          20260719000000_init_postgres — fresh Postgres baseline
```

## `src/server/*` — what's in each module

| Module          | Purpose                                                                                                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`        | `env.ts` — Zod-validated, fails fast at boot on missing/malformed config. `flags.ts` — feature flag loader.                                                                                                                                                                                                                                   |
| `logger`        | Central `pino` logger. `createChildLogger({ module })` scopes every log line.                                                                                                                                                                                                                                                                 |
| `errors`        | `AppError` hierarchy (`ValidationError`, `NotFoundError`, `BusinessRuleError`, ...) + `toErrorResult()`, the single place that maps any thrown value to an HTTP status + response body and decides whether it's worth a Sentry alert.                                                                                                         |
| `http`          | `createRouteHandler()` — wraps a Route Handler with request-ID, timing, metrics, and error mapping. `ok()`/`created()`/`fail()` — the `{ data, meta? }` / `{ error: { code, message } }` envelope every endpoint returns. `parsePagination`/`parseSort` — safe, allowlisted query parsing.                                                    |
| `auth`          | JWT access/refresh (`jose`, edge + Node compatible) for headless API clients — separate from the player web app's existing NextAuth session, which is untouched. Refresh-token rotation with reuse detection (stolen-token replay revokes the whole session family), Redis-backed access-token blacklist, `withAuth`/`withRole` route guards. |
| `audit`         | `AuditService.record()` — the only writer to the `AuditLog` table. A failed audit write never fails the operation it's describing (logged, not thrown).                                                                                                                                                                                       |
| `cache`         | Shared Redis client (`ioredis`, lazy-connect). `CacheService` (get/set/remember/lock). `createRateLimiter()` + `withRateLimit()` — fixed-window limiter, pre-named for login/API/admin/webhooks with placeholder thresholds.                                                                                                                  |
| `queue`         | BullMQ `createQueue()`/`createWorker()` with retry + dead-letter hand-off built in. One infra self-test job (`system.heartbeat`) proves the pipeline end to end — no business jobs.                                                                                                                                                           |
| `events`        | In-process pub/sub (`eventBus`) behind an `IEventBus` interface, swappable for a cross-process broker later without changing publisher/subscriber call sites.                                                                                                                                                                                 |
| `websocket`     | Standalone `ws` server (own process — Route Handlers can't hold a persistent Upgrade connection) with rooms + Redis-relayed broadcast for horizontal scaling. No message protocol wired yet.                                                                                                                                                  |
| `uploads`       | `IStorageDriver` (local disk today, S3-compatible driver ready behind `UPLOADS_DRIVER=s3`) + file validation rules.                                                                                                                                                                                                                           |
| `observability` | `checkDatabase()`/`checkRedis()` (used by `/api/health/ready`), Prometheus metrics registry (`/api/metrics`), Sentry hook (no-op until `SENTRY_DSN` is set).                                                                                                                                                                                  |
| `security`      | AES-256-GCM `encrypt`/`decrypt` for at-rest sensitive fields, `sha256Hex`, CORS (`withCors`, allowlist-driven), double-submit-cookie CSRF helpers.                                                                                                                                                                                            |
| `docs`          | Hand-authored OpenAPI 3.0 spec matching the actual response envelope — extend per route as modules land.                                                                                                                                                                                                                                      |

## The module convention

Every future business module (`auth`, `wallet`, `game`, `affiliates`,
`financial`, `admin`, `users`, `rtp`, `analytics`, `settings`,
`notifications`) follows:

```
Route Handler → controller → service → repository (via interface)
```

A service never imports Prisma or `next/server` directly — it depends on a
repository _interface_, which is what lets `src/modules/_template`'s
service be unit-tested against an in-memory fake with zero database. See
[`src/modules/_template/README.md`](src/modules/_template/README.md) for
the full layout (`controllers/services/repositories/dto/validators/
entities/events/types/interfaces/hooks/tests/constants/utils`) and a
working, tested example — copy it, don't start from scratch.

No module folder is pre-created for the eleven domains above; empty
directories are throwaway scaffolding, not infrastructure. They get created
when their phase starts.

## Database

- **PostgreSQL**, not SQLite (Phase 1 used SQLite for a fast prototype —
  Phase 2 migrates to the mandated stack). Run it via
  `npm run docker:up` (starts `postgres` + `redis` from
  `docker-compose.yml`, plus `adminer`/`redis-commander` for local
  inspection).
- **UUID primary keys** everywhere (`@default(uuid())`), replacing the
  prior `cuid()` — a pure ID-strategy change, no behavior change.
- **`AuditLog`** — durable, indexed, append-only. **`Role`** enum
  (`SUPER_ADMIN` … `AUDIT`) — not yet attached to any table; it's the
  vocabulary `server/auth`'s JWT claims and RBAC guards use.
- Indexes added on existing tables for query patterns already in use
  (`Transaction(userId, type)`, `Match(userId, status)`, etc.) — structural,
  not a business change.
- **Soft delete is deliberately NOT applied** to existing tables this
  phase — adding a `deletedAt` column without threading `deletedAt: null`
  through every existing query would be a half-finished feature. The
  pattern is documented for the module that adopts it first.
- The initial migration (`prisma/migrations/20260719000000_init_postgres`)
  was generated via `prisma migrate diff --from-empty` — this sandbox has
  no live Postgres, so it could be schema-validated and Client-generated,
  but not applied. Run `npm run db:migrate:deploy` against a real Postgres
  to apply it.

## RBAC

`Role` enum: `SUPER_ADMIN, ADMIN, FINANCE, OPERATOR, MODERATOR, SUPPORT,
COMPLIANCE, AUDIT`. `hasRole()` is the only real check today (`SUPER_ADMIN`
always passes). `hasPermission()` and `ROLE_PERMISSIONS` exist as the
extension point for a fine-grained permission matrix — currently empty, so
every non-`SUPER_ADMIN` role fails closed on any permission check until a
real module defines its permission strings.

## What's honestly NOT verified here

This sandbox has no Docker, Postgres, or Redis daemon available. Verified:

- `prisma validate` / `prisma generate` (schema-only, no connection needed)
- `prisma migrate diff` produced a syntactically-correct Postgres migration
- TypeScript (`tsc --noEmit`), ESLint, Prettier — clean across the repo
- The full Vitest unit suite (72 tests) — everything that doesn't require a
  live Postgres/Redis, using interfaces + in-memory fakes
  (`tests/helpers/README.md`) or, for the audit log, an intentional
  graceful-failure path (it correctly logs and continues when Postgres is
  unreachable — see `AuditService.record`'s test-visible behavior)
- `next build` (production build succeeds)
- The `/api/template-reference/template-items` reference route, live in the
  browser against the mock/no-DB dev environment where it doesn't touch
  Postgres

**Not verified** (needs a real environment): `docker compose up` actually
starting Postgres/Redis/the app; `prisma migrate deploy` applying the
migration to a live database; BullMQ jobs actually processing; the
WebSocket server actually accepting connections and relaying broadcasts
across replicas. The code is written and typechecked against these
libraries' real APIs, but "compiles and typechecks" isn't "verified
running" — run `npm run docker:up` in an environment with Docker to close
that gap before relying on it in anger.

## Local development

```bash
cp .env.example .env        # fill in secrets (see comments in the file)
npm install
npm run docker:up           # Postgres + Redis + Adminer + Redis Commander
npm run db:migrate:deploy   # apply prisma/migrations to the fresh database
npm run db:seed
npm run dev                 # Next.js app — player app + /admin mockup
npm run worker              # separate terminal — BullMQ worker
npm run ws                  # separate terminal — WebSocket server
```

`npm run test` / `npm run typecheck` / `npm run lint` / `npm run format` do
not require Docker.
