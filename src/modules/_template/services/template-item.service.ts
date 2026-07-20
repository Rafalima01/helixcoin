import type { ITemplateItemRepository } from "@/modules/_template/interfaces/template-item-repository.interface";
import type { TemplateItem } from "@/modules/_template/entities/template-item.entity";
import { TEMPLATE_ITEM_EVENTS } from "@/modules/_template/events/template-item.events";
import { NotFoundError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { AuditService, type AuditRecordInput } from "@/server/audit";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "template-item.service" });

/**
 * Business logic layer. Depends on the repository INTERFACE (constructor
 * injection) — never imports Prisma or the in-memory repository directly,
 * which is exactly what makes tests/template-item.service.test.ts able to
 * inject a fake and test this in isolation, no database required.
 *
 * The controller (controllers/template-item.controller.ts) is the only
 * thing that calls this; this never imports NextRequest/NextResponse.
 */
export class TemplateItemService {
  constructor(private readonly repository: ITemplateItemRepository) {}

  async create(
    name: string,
    actor?: Pick<AuditRecordInput, "actorId" | "actorType">
  ): Promise<TemplateItem> {
    const item = await this.repository.create(name);

    eventBus.publish(TEMPLATE_ITEM_EVENTS.created, { item }, item.id);

    await AuditService.record({
      actorId: actor?.actorId ?? null,
      actorType: actor?.actorType ?? "SYSTEM",
      action: "template-item.create",
      entityType: "TemplateItem",
      entityId: item.id,
      after: item,
    });

    logger.info({ itemId: item.id }, "template item created");
    return item;
  }

  async getById(id: string): Promise<TemplateItem> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundError("TemplateItem");
    return item;
  }

  async list(): Promise<TemplateItem[]> {
    return this.repository.list();
  }
}
