import type { TemplateItem } from "@/modules/_template/entities/template-item.entity";

/**
 * Repository Pattern: the service layer (services/template-item.service.ts)
 * depends on THIS interface, never on `@/lib/prisma` directly. Two
 * implementations exist — repositories/template-item.prisma-repository.ts
 * for real persistence, repositories/template-item.in-memory-repository.ts
 * for tests — and the service can't tell which one it was given.
 */
export interface ITemplateItemRepository {
  create(name: string): Promise<TemplateItem>;
  findById(id: string): Promise<TemplateItem | null>;
  list(): Promise<TemplateItem[]>;
}
