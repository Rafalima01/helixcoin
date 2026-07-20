import { z } from "zod";

export const createTemplateItemSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
});

export type CreateTemplateItemInput = z.infer<typeof createTemplateItemSchema>;
