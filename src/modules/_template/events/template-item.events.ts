import type { TemplateItem } from "@/modules/_template/entities/template-item.entity";

/** Event name constants — import these, never hardcode the string at a publish/subscribe call site. */
export const TEMPLATE_ITEM_EVENTS = {
  created: "template-item.created",
} as const;

export interface TemplateItemCreatedPayload {
  item: TemplateItem;
}
