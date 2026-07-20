import { z } from "zod";

export const confirmEmailVerificationSchema = z
  .object({
    token: z.string().min(1, "Token inválido"),
  })
  .strict();
