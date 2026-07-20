import { z } from "zod";
import {
  MODE_FIELDS,
  GENERAL_FIELDS,
  ANTI_CHEAT_FIELDS,
  GAME_MODES,
  type ModeFieldDef,
  type GeneralFieldKey,
  type AntiCheatFieldKey,
} from "@/modules/game-config/constants/field-registry";

/** Preserves literal key names through Object.fromEntries, instead of collapsing to a generic string index signature — that's what lets generalSchema/antiCheatSchema infer named, individually-typed properties (betMin, maxVerticalSpeed, ...) rather than an unkeyed Record. */
type ShapeFor<K extends string, V> = { [P in K]: V };

/**
 * Every Zod schema here is BUILT FROM the field registry rather than
 * hand-written — one min/max/type definition per knob, reused for
 * validation, the admin UI, and defaults. See field-registry.ts's doc
 * comment.
 */
function fieldSchema(def: ModeFieldDef) {
  if (def.kind === "boolean") return z.boolean();
  let schema = z.number();
  if (def.min !== undefined) schema = schema.min(def.min);
  if (def.max !== undefined) schema = schema.max(def.max);
  return schema;
}

const modeProfileShape = Object.fromEntries(
  MODE_FIELDS.map((f) => [f.key, fieldSchema(f).optional()])
) as Record<string, z.ZodOptional<z.ZodTypeAny>>;

export const modeProfileSchema = z.object(modeProfileShape);
export type ModeProfileInput = z.infer<typeof modeProfileSchema>;

const modesShape = Object.fromEntries(GAME_MODES.map((m) => [m, modeProfileSchema.optional()])) as Record<
  string,
  z.ZodOptional<typeof modeProfileSchema>
>;
export const modesSchema = z.object(modesShape);

const generalNumericShape = Object.fromEntries(
  GENERAL_FIELDS.map((f) => [f.key, z.number().min(f.min).max(f.max).optional()])
) as ShapeFor<GeneralFieldKey, z.ZodOptional<z.ZodNumber>>;

export const generalSchema = z.object({
  ...generalNumericShape,
  quickBetAmounts: z
    .array(z.number().int().min(1, "Valor deve ser positivo"))
    .min(1, "Informe ao menos um botão de aposta rápida")
    .max(8, "No máximo 8 botões de aposta rápida")
    .optional(),
  goalAllowFixed: z.boolean().optional(),
  goalAllowDynamic: z.boolean().optional(),
});
export type GeneralInput = z.infer<typeof generalSchema>;

const antiCheatShape = Object.fromEntries(
  ANTI_CHEAT_FIELDS.map((f) => [f.key, z.number().min(f.min).max(f.max).optional()])
) as ShapeFor<AntiCheatFieldKey, z.ZodOptional<z.ZodNumber>>;
export const antiCheatSchema = z.object(antiCheatShape);
export type AntiCheatInput = z.infer<typeof antiCheatSchema>;

/** Body accepted by `POST /api/admin/game-config/draft` — a partial patch merged onto the current draft. */
export const upsertDraftSchema = z.object({
  description: z.string().trim().max(500).optional(),
  general: generalSchema.optional(),
  modes: modesSchema.optional(),
  antiCheat: antiCheatSchema.optional(),
});
export type UpsertDraftInput = z.infer<typeof upsertDraftSchema>;

export const activateSchema = z.object({
  /** Activates a specific draft/archived version; omit to activate the current draft. */
  versionId: z.string().uuid().optional(),
});
export type ActivateInput = z.infer<typeof activateSchema>;

export const listVersionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
