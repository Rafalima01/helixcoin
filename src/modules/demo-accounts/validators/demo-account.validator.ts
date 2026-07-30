import { z } from "zod";

export const createDemoAccountSchema = z
  .object({
    /** Reais, converted to cents server-side by the controller — mirrors how deposit/withdraw amount inputs work elsewhere. Default R$100 is applied client-side; 0 is allowed (admin can add balance later). */
    initialBalanceCents: z.number().int().min(0, "Saldo inicial não pode ser negativo"),
  })
  .strict();

export const addDemoBalanceSchema = z
  .object({
    amountCents: z.number().int().positive("Informe um valor maior que zero"),
  })
  .strict();
