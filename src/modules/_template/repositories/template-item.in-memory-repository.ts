import type { ITemplateItemRepository } from "@/modules/_template/interfaces/template-item-repository.interface";
import type { TemplateItem } from "@/modules/_template/entities/template-item.entity";

/**
 * In-memory implementation — what tests inject instead of a real database
 * (see tests/template-item.service.test.ts). Also a legitimate choice for
 * local dev/demos when no database is configured, though modules with real
 * persistence needs add a Prisma-backed implementation alongside this one
 * (see this module's README for what that looks like once a matching
 * Prisma model exists).
 */
export class InMemoryTemplateItemRepository implements ITemplateItemRepository {
  private readonly items = new Map<string, TemplateItem>();

  async create(name: string): Promise<TemplateItem> {
    const item: TemplateItem = { id: crypto.randomUUID(), name, createdAt: new Date() };
    this.items.set(item.id, item);
    return item;
  }

  async findById(id: string): Promise<TemplateItem | null> {
    return this.items.get(id) ?? null;
  }

  async list(): Promise<TemplateItem[]> {
    return [...this.items.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
