import { describe, expect, it, vi } from "vitest";
import { TemplateItemService } from "@/modules/_template/services/template-item.service";
import { InMemoryTemplateItemRepository } from "@/modules/_template/repositories/template-item.in-memory-repository";
import { TEMPLATE_ITEM_EVENTS } from "@/modules/_template/events/template-item.events";
import { eventBus } from "@/server/events";
import { NotFoundError } from "@/server/errors";

/**
 * Reference test for the module convention: constructs the service with
 * the in-memory repository (no database), asserts on business behavior AND
 * on the side effects (event published, entity returned) — the same shape
 * a real module's service test follows.
 */
function buildService() {
  return new TemplateItemService(new InMemoryTemplateItemRepository());
}

describe("TemplateItemService", () => {
  it("creates an item and returns it with a generated id and timestamp", async () => {
    const service = buildService();
    const item = await service.create("Example");
    expect(item.name).toBe("Example");
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeInstanceOf(Date);
  });

  it("publishes a template-item.created event on create", async () => {
    const service = buildService();
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe(TEMPLATE_ITEM_EVENTS.created, handler);

    const item = await service.create("Notify me");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].payload.item).toEqual(item);
    unsubscribe();
  });

  it("getById returns a previously created item", async () => {
    const service = buildService();
    const created = await service.create("Findable");
    await expect(service.getById(created.id)).resolves.toEqual(created);
  });

  it("getById throws NotFoundError for an unknown id", async () => {
    const service = buildService();
    await expect(service.getById("does-not-exist")).rejects.toThrow(NotFoundError);
  });

  it("list returns items in creation order", async () => {
    const service = buildService();
    const first = await service.create("First");
    const second = await service.create("Second");
    await expect(service.list()).resolves.toEqual([first, second]);
  });
});
