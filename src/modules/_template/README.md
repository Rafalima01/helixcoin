# Module convention (`_template`)

This is a working, tested reference implementation of the layering every
business module (`src/modules/<domain>`) follows from Phase 3 onward. It's
not a real feature — `TemplateItem` is an intentionally meaningless domain
("an item with a name") so nobody mistakes this for product code. Copy this
folder, rename `template-item` → your entity, delete what you don't need.

## Layout

```
_template/
  controllers/    thin HTTP adapters — validate, call a service, shape the response
  services/       business logic — depends on repository INTERFACES, not Prisma
  repositories/   persistence — one class per backing store, all implementing
                  the same interfaces/ contract
  interfaces/     the contracts services and repositories are written against
  dto/            request/response shapes crossing HTTP (never the entity as-is)
  validators/     Zod schemas — the only place input shape is checked
  entities/       domain types business logic operates on
  events/         event name constants + payload types this module publishes
  constants/      module-scoped constants
  utils/          pure helpers with no dependency on any other layer here
  hooks/          frontend React Query hooks calling this module's routes
  tests/          co-located unit tests (see vitest.config.ts's include glob)
```

## The dependency rule

```
Route Handler (src/app/api/**) → controller → service → repository (via interface)
```

A controller never touches a repository directly. A service never imports
`next/server` or Prisma. This is what makes `template-item.service.test.ts`
able to test real business logic with zero database — it injects
`InMemoryTemplateItemRepository` instead of a Prisma-backed one, and the
service can't tell the difference.

## Adding the Prisma-backed repository

No `TemplateItem` table exists (this module is deliberately not real data),
so only the in-memory repository is implemented here. Once a real module
has a matching Prisma model, add a sibling repository like this:

```ts
// repositories/template-item.prisma-repository.ts
import { prisma } from "@/lib/prisma";
import type { ITemplateItemRepository } from "@/modules/_template/interfaces/template-item-repository.interface";

export class PrismaTemplateItemRepository implements ITemplateItemRepository {
  async create(name: string) {
    return prisma.templateItem.create({ data: { name } });
  }
  async findById(id: string) {
    return prisma.templateItem.findUnique({ where: { id } });
  }
  async list() {
    return prisma.templateItem.findMany({ orderBy: { createdAt: "asc" } });
  }
}
```

Then swap the singleton in `controllers/template-item.controller.ts` (or,
better, wire real dependency selection based on environment/test context).

## Reference wiring

`src/app/api/template-reference/template-items/route.ts` mounts this
module's controller for real — `GET`/`POST` actually work. It's there so
the whole chain (route → controller → service → repository → event bus →
audit log → error handling → response envelope) is provably connected, not
just type-checked in isolation. Delete it once real modules make it
redundant.

Note the route does **not** live under an `_`-prefixed folder: Next.js App
Router treats a leading underscore as a private-folder marker and silently
excludes it from routing — a real bug caught during Phase 2 verification
(the route built without error and simply wasn't reachable).

## Future domain modules

The Phase 2 brief names these as the frontend integration surfaces to
prepare for (`INTEGRAÇÃO COM FRONTEND`). Each becomes a `src/modules/<name>`
directory following this exact layout when its phase arrives — no module
folders are pre-created empty; that's throwaway scaffolding, not
infrastructure:

`auth` · `wallet` · `game` · `affiliates` · `financial` · `admin` · `users`
· `rtp` · `analytics` · `settings` · `notifications`
