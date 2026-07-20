import type { NextRequest } from "next/server";
import { created, ok } from "@/server/http";
import { getAuthContext } from "@/server/auth";
import { createTemplateItemSchema } from "@/modules/_template/validators/template-item.validator";
import { toTemplateItemResponseDto } from "@/modules/_template/dto/template-item.dto";
import { TemplateItemService } from "@/modules/_template/services/template-item.service";
import { InMemoryTemplateItemRepository } from "@/modules/_template/repositories/template-item.in-memory-repository";

/**
 * Thin HTTP adapter: validate → call the service → shape the response. No
 * business logic lives here — that's services/template-item.service.ts's
 * job. This is what a Route Handler under src/app/api delegates to (see
 * src/app/api/_template/template-items/route.ts).
 *
 * One repository instance per process (module-scope singleton) — swap for
 * a Prisma-backed one the same way src/lib/prisma.ts does, once a real
 * module needs persistence beyond the process lifetime.
 */
const repository = new InMemoryTemplateItemRepository();
const service = new TemplateItemService(repository);

export async function handleListTemplateItems() {
  const items = await service.list();
  return ok(items.map(toTemplateItemResponseDto));
}

export async function handleCreateTemplateItem(req: NextRequest) {
  const body = createTemplateItemSchema.parse(await req.json());
  const auth = await getAuthContext(req);

  const item = await service.create(body.name, {
    actorId: auth?.userId ?? null,
    actorType: auth ? "USER" : "SYSTEM",
  });

  return created(toTemplateItemResponseDto(item));
}
