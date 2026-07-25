import type {
  IPaymentSettingsRepository,
  UpdatePaymentSettingsInput,
} from "@/modules/payments/interfaces/payment-settings-repository.interface";
import type { PaymentSettings } from "@/modules/payments/entities/payments.entity";
import { DEFAULT_PAYMENT_SETTINGS_ID } from "@/modules/payments/constants/payments.constants";

function defaults(): PaymentSettings {
  return {
    id: DEFAULT_PAYMENT_SETTINGS_ID,
    defaultGatewayCredentialId: null,
    routingMode: "SINGLE",
    timeoutMs: 15000,
    maxRetries: 2,
    pixExpirationMinutes: 30,
    depositMinCents: 500,
    depositMaxCents: 1000000,
    withdrawMinCents: 1000,
    withdrawMaxCents: 1000000,
    maxWebhookProcessingMs: 5000,
    updatedAt: new Date(),
  };
}

export class InMemoryPaymentSettingsRepository implements IPaymentSettingsRepository {
  private row: PaymentSettings | null = null;

  async get(): Promise<PaymentSettings> {
    if (!this.row) this.row = defaults();
    return this.row;
  }

  async update(input: UpdatePaymentSettingsInput): Promise<PaymentSettings> {
    const current = await this.get();
    this.row = { ...current, ...input, updatedAt: new Date() };
    return this.row;
  }
}
