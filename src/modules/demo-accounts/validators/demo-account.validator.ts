import { z } from "zod";
import { DEMO_ACCOUNT_NAME_MAX_LENGTH } from "@/modules/demo-accounts/utils/display-name.util";

/**
 * Nome de identificação administrativa da conta. `trim()` roda ANTES do
 * `min(1)`, então uma string só de espaços é rejeitada, não silenciosamente
 * salva como vazia. O teto de 60 acompanha a convenção de
 * `user.validator.ts` (firstName/lastName são `.max(60)` cada) — aqui é o
 * nome inteiro, portanto o limite é conservador em relação às duas colunas.
 */
const demoAccountNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome para a conta")
  .max(DEMO_ACCOUNT_NAME_MAX_LENGTH, `O nome deve ter no máximo ${DEMO_ACCOUNT_NAME_MAX_LENGTH} caracteres`);

export const createDemoAccountSchema = z
  .object({
    /** Reais, converted to cents server-side by the controller — mirrors how deposit/withdraw amount inputs work elsewhere. Default R$100 is applied client-side; 0 is allowed (admin can add balance later). */
    initialBalanceCents: z.number().int().min(0, "Saldo inicial não pode ser negativo"),
    /** Opcional — omitido, a conta nasce como "Conta Demo", exatamente como antes. */
    name: demoAccountNameSchema.optional(),
  })
  .strict();

/** PATCH /api/admin/demo-accounts/{id} — altera SOMENTE o nome exibido. Nenhum outro campo é aceito (`.strict()`). */
export const renameDemoAccountSchema = z
  .object({
    name: demoAccountNameSchema,
  })
  .strict();

export const addDemoBalanceSchema = z
  .object({
    amountCents: z.number().int().positive("Informe um valor maior que zero"),
  })
  .strict();

export const setDemoFlagSchema = z
  .object({
    isDemo: z.boolean(),
  })
  .strict();
