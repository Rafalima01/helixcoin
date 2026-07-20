import type { TemplateItem } from "@/modules/_template/entities/template-item.entity";

/** What the controller accepts, already validated by the Zod schema in validators/. */
export interface CreateTemplateItemDto {
  name: string;
}

/** What the controller returns — an explicit response shape, not the entity re-exported as-is. */
export interface TemplateItemResponseDto {
  id: string;
  name: string;
  createdAt: string; // ISO string — entities use Date, DTOs crossing HTTP use strings
}

export function toTemplateItemResponseDto(entity: TemplateItem): TemplateItemResponseDto {
  return { id: entity.id, name: entity.name, createdAt: entity.createdAt.toISOString() };
}
