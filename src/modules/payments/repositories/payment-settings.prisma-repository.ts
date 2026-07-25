import type { PaymentSettings as PrismaPaymentSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPaymentSettingsRepository,
  UpdatePaymentSettingsInput,
} from "@/modules/payments/interfaces/payment-settings-repository.interface";
import type { PaymentSettings } from "@/modules/payments/entities/payments.entity";
import { DEFAULT_PAYMENT_SETTINGS_ID } from "@/modules/payments/constants/payments.constants";

function toEntity(row: PrismaPaymentSettings): PaymentSettings {
  return {
    id: row.id,
    defaultGatewayCredentialId: row.defaultGatewayCredentialId,
    routingMode: row.routingMode,
    timeoutMs: row.timeoutMs,
    maxRetries: row.maxRetries,
    pixExpirationMinutes: row.pixExpirationMinutes,
    depositMinCents: row.depositMinCents,
    depositMaxCents: row.depositMaxCents,
    withdrawMinCents: row.withdrawMinCents,
    withdrawMaxCents: row.withdrawMaxCents,
    maxWebhookProcessingMs: row.maxWebhookProcessingMs,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPaymentSettingsRepository implements IPaymentSettingsRepository {
  async get(): Promise<PaymentSettings> {
    const row = await prisma.paymentSettings.upsert({
      where: { id: DEFAULT_PAYMENT_SETTINGS_ID },
      update: {},
      create: { id: DEFAULT_PAYMENT_SETTINGS_ID },
    });
    return toEntity(row);
  }

  async update(input: UpdatePaymentSettingsInput): Promise<PaymentSettings> {
    const row = await prisma.paymentSettings.upsert({
      where: { id: DEFAULT_PAYMENT_SETTINGS_ID },
      update: { ...input },
      create: { id: DEFAULT_PAYMENT_SETTINGS_ID, ...input },
    });
    return toEntity(row);
  }
}
