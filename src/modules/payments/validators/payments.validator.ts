import { z } from "zod";

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/** POST /api/payments/deposits — amount is reais (matches the existing deposit-panel UX), converted to cents in the controller via roundToCents. Min/max are enforced against PaymentSettings in PaymentService, not hardcoded here — an admin-configurable business rule, not a request-shape rule. */
export const createDepositSchema = z.object({
  amount: z.number().positive("Valor deve ser positivo"),
});
export type CreateDepositInput = z.infer<typeof createDepositSchema>;

/** POST /api/payments/deposits/{id}/simulate — Mock-only demo action. `outcome` defaults to PAID; FAILED exists so the failure path is exercisable from the same UI without a second endpoint. Player-facing — deliberately narrower than the admin simulator (adminSimulateDepositSchema below), which also covers CANCELLED/EXPIRED/REFUNDED. */
export const simulateDepositSchema = z.object({
  outcome: z.enum(["PAID", "FAILED"]).default("PAID"),
});
export type SimulateDepositInput = z.infer<typeof simulateDepositSchema>;

export const pixKeyTypeSchema = z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]);

/** POST /api/payments/withdrawals */
export const requestWithdrawSchema = z.object({
  amount: z.number().positive("Valor deve ser positivo"),
  pixKey: z.string().trim().min(3, "Informe uma chave PIX válida"),
  pixKeyType: pixKeyTypeSchema.optional(),
});
export type RequestWithdrawInput = z.infer<typeof requestWithdrawSchema>;

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** PATCH-style withdrawal decision. Simulated settlement only ever runs for a MOCK gateway credential — enforced in the service, not here. */
export const adminWithdrawDecisionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().trim().min(3).optional(),
  })
  .refine((v) => v.action !== "REJECT" || !!v.rejectionReason, {
    message: "Motivo da rejeição é obrigatório",
    path: ["rejectionReason"],
  });
export type AdminWithdrawDecisionInput = z.infer<typeof adminWithdrawDecisionSchema>;

export const gatewayProviderSchema = z.enum([
  "MOCK",
  "CARTPANDA",
  "CARTWAVEHUB",
  "MERCADO_PAGO",
  "PAY4FUN",
  "BSPAY",
  "PAY2M",
  "OPENPIX",
  "VEOPAG",
  "AMPLOPAY",
  "OUTROS",
]);

const gatewayHealthStatusSchema = z.enum(["ONLINE", "DEGRADED", "OFFLINE"]);
const gatewaySimulatedFaultSchema = z.enum(["TIMEOUT", "ERROR_500", "AUTH_ERROR", "OFFLINE_CALLS"]);

/** Admin-only Fase 10 simulator — POST /api/admin/payments/deposits/{id}/simulate. Broader than the player-facing simulateDepositSchema on purpose: CANCELLED/EXPIRED/REFUNDED are ops/testing scenarios, not something a player triggers on their own deposit. */
export const adminSimulateDepositSchema = z.object({
  outcome: z.enum(["PAID", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"]),
});
export type AdminSimulateDepositInput = z.infer<typeof adminSimulateDepositSchema>;

/** `credentials` is the raw, provider-specific JSON blob (for MOCK, `{}`) — AES-256-GCM encrypted before storage, never persisted as plain JSON. */
export const gatewayCredentialCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório"),
  provider: gatewayProviderSchema,
  mode: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
  credentials: z.record(z.string(), z.unknown()).default({}),
  webhookSecret: z.string().min(8, "Segredo do webhook deve ter ao menos 8 caracteres"),
  active: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
  weight: z.number().int().min(1).default(1),
  timeoutMs: z.number().int().min(1000).default(15000),
  maxRetries: z.number().int().min(0).max(10).default(2),
  simulatedHealth: gatewayHealthStatusSchema.nullable().optional(),
  simulatedErrorMode: gatewaySimulatedFaultSchema.nullable().optional(),
});
export type GatewayCredentialCreateInput = z.infer<typeof gatewayCredentialCreateSchema>;

export const gatewayCredentialUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  mode: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  webhookSecret: z.string().min(8).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  weight: z.number().int().min(1).optional(),
  timeoutMs: z.number().int().min(1000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  simulatedHealth: gatewayHealthStatusSchema.nullable().optional(),
  simulatedErrorMode: gatewaySimulatedFaultSchema.nullable().optional(),
});
export type GatewayCredentialUpdateInput = z.infer<typeof gatewayCredentialUpdateSchema>;

export const paymentSettingsUpdateSchema = z.object({
  defaultGatewayCredentialId: z.string().nullable().optional(),
  routingMode: z.enum(["SINGLE", "ROUND_ROBIN", "WEIGHTED", "FAILOVER"]).optional(),
  timeoutMs: z.number().int().min(1000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  pixExpirationMinutes: z.number().int().min(1).optional(),
  depositMinCents: z.number().int().min(0).optional(),
  depositMaxCents: z.number().int().min(1).optional(),
  withdrawMinCents: z.number().int().min(0).optional(),
  withdrawMaxCents: z.number().int().min(1).optional(),
  maxWebhookProcessingMs: z.number().int().min(100).optional(),
});
export type PaymentSettingsUpdateInput = z.infer<typeof paymentSettingsUpdateSchema>;

export const adminDepositListQuerySchema = z.object({
  status: z.string().optional(),
  gatewayCredentialId: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminDepositListQuery = z.infer<typeof adminDepositListQuerySchema>;

export const adminWithdrawListQuerySchema = z.object({
  status: z.string().optional(),
  gatewayCredentialId: z.string().optional(),
  userId: z.string().optional(),
  /** Filtro "Reais / Simulações" do backoffice. Ausente = ambos. Enum de string (não `z.coerce.boolean`, que trata "false" como true). */
  simulated: z.enum(["true", "false"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminWithdrawListQuery = z.infer<typeof adminWithdrawListQuerySchema>;

export const adminGatewayListQuerySchema = z.object({
  provider: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
export type AdminGatewayListQuery = z.infer<typeof adminGatewayListQuerySchema>;

export const adminWebhookListQuerySchema = z.object({
  status: z.string().optional(),
  provider: z.string().optional(),
  relatedType: z.string().optional(),
  relatedId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminWebhookListQuery = z.infer<typeof adminWebhookListQuerySchema>;

export const adminGatewayLogListQuerySchema = z.object({
  gatewayCredentialId: z.string().optional(),
  provider: z.string().optional(),
  direction: z.enum(["outbound", "inbound"]).optional(),
  correlationId: z.string().optional(),
  success: z.coerce.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminGatewayLogListQuery = z.infer<typeof adminGatewayLogListQuerySchema>;
