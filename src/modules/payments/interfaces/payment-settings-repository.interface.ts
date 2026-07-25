import type { PaymentSettings, RoutingMode } from "@/modules/payments/entities/payments.entity";

export interface UpdatePaymentSettingsInput {
  defaultGatewayCredentialId?: string | null;
  routingMode?: RoutingMode;
  timeoutMs?: number;
  maxRetries?: number;
  pixExpirationMinutes?: number;
  depositMinCents?: number;
  depositMaxCents?: number;
  withdrawMinCents?: number;
  withdrawMaxCents?: number;
  maxWebhookProcessingMs?: number;
}

/** Single global row (id "global") — `get()` creates it with defaults on first read, same pattern as GameConfig. */
export interface IPaymentSettingsRepository {
  get(): Promise<PaymentSettings>;
  update(input: UpdatePaymentSettingsInput): Promise<PaymentSettings>;
}
