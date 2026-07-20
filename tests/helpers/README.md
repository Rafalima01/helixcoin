# Test helpers

Conventions for the backend test suite, established in Phase 2 (infrastructure only —
no business-module tests live here yet).

## Layout

```
tests/
  setup.ts              global Vitest setup (env, matchers)
  unit/                 mirrors src/server/** — pure functions, no I/O mocked away
  integration/          exercises route handlers via test doubles below
  helpers/
    factories.ts         builders for DTOs/entities used across tests
    mocks.ts              in-memory fakes for Prisma, Redis and the queue
```

## Why in-memory fakes, not real Postgres/Redis in CI

Phase 2 has no live Postgres/Redis in this environment. Repositories and
services depend on interfaces (`IRepository<T>`, `ICache`, `IQueue`), not
concrete clients — tests inject an in-memory fake that satisfies the same
interface. When a real integration/e2e suite is introduced (Phase 3+), it
will spin up `docker-compose.yml`'s `postgres`/`redis` services in CI and
swap the fakes for the real adapters; no test _files_ need to change, only
which factory wires the dependency.

## Example (added when the first real module lands)

```ts
import { InMemoryRepository } from "../helpers/mocks";
import type { UserEntity } from "@/modules/users/entities/user.entity";

const repo = new InMemoryRepository<UserEntity>();
```
