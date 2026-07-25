import type { PaymentWebhook, WebhookStatus, PaymentRelatedType, GatewayProvider } from "@/modules/payments/entities/payments.entity";

export interface CreatePaymentWebhookInput {
  id?: string;
  gatewayCredentialId: string;
  provider: GatewayProvider;
  relatedType: PaymentRelatedType;
  relatedId: string;
  eventType: string;
  status?: WebhookStatus;
  providerEventId?: string | null;
  payloadHash: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
}

export interface UpdatePaymentWebhookInput {
  status?: WebhookStatus;
  responseStatus?: number | null;
  responseBody?: Record<string, unknown> | null;
  errorMessage?: string | null;
  processedAt?: Date | null;
  reprocessedAt?: Date | null;
  reprocessCount?: number;
  processingMs?: number | null;
}

export interface PaymentWebhookListFilter {
  status?: WebhookStatus;
  provider?: GatewayProvider;
  relatedType?: PaymentRelatedType;
  relatedId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface IPaymentWebhookRepository {
  create(input: CreatePaymentWebhookInput): Promise<PaymentWebhook>;
  findById(id: string): Promise<PaymentWebhook | null>;
  findByProviderEventId(providerEventId: string): Promise<PaymentWebhook | null>;
  findByPayloadHash(payloadHash: string): Promise<PaymentWebhook | null>;
  update(id: string, input: UpdatePaymentWebhookInput): Promise<PaymentWebhook>;
  listAdmin(filter: PaymentWebhookListFilter): Promise<{ items: PaymentWebhook[]; total: number }>;
}
