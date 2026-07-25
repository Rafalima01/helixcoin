import { WebhookConflictError } from "@/modules/payments/errors";
import type {
  IPaymentWebhookRepository,
  CreatePaymentWebhookInput,
  UpdatePaymentWebhookInput,
  PaymentWebhookListFilter,
} from "@/modules/payments/interfaces/payment-webhook-repository.interface";
import type { PaymentWebhook } from "@/modules/payments/entities/payments.entity";

export class InMemoryPaymentWebhookRepository implements IPaymentWebhookRepository {
  private readonly rows = new Map<string, PaymentWebhook>();

  async create(input: CreatePaymentWebhookInput): Promise<PaymentWebhook> {
    const id = input.id ?? crypto.randomUUID();
    if (input.providerEventId && [...this.rows.values()].some((r) => r.providerEventId === input.providerEventId)) {
      throw new WebhookConflictError(input.providerEventId);
    }
    const row: PaymentWebhook = {
      id,
      gatewayCredentialId: input.gatewayCredentialId,
      provider: input.provider,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      eventType: input.eventType,
      status: input.status ?? "RECEIVED",
      providerEventId: input.providerEventId ?? null,
      payloadHash: input.payloadHash,
      payload: input.payload,
      responseStatus: null,
      responseBody: null,
      signatureValid: input.signatureValid,
      errorMessage: null,
      receivedAt: new Date(),
      processedAt: null,
      reprocessedAt: null,
      reprocessCount: 0,
      processingMs: null,
    };
    this.rows.set(id, row);
    return row;
  }

  async findById(id: string): Promise<PaymentWebhook | null> {
    return this.rows.get(id) ?? null;
  }

  async findByProviderEventId(providerEventId: string): Promise<PaymentWebhook | null> {
    return [...this.rows.values()].find((r) => r.providerEventId === providerEventId) ?? null;
  }

  async findByPayloadHash(payloadHash: string): Promise<PaymentWebhook | null> {
    return [...this.rows.values()]
      .filter((r) => r.payloadHash === payloadHash)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0] ?? null;
  }

  async update(id: string, input: UpdatePaymentWebhookInput): Promise<PaymentWebhook> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`PaymentWebhook ${id} not found`);
    const updated: PaymentWebhook = { ...existing, ...input };
    this.rows.set(id, updated);
    return updated;
  }

  async listAdmin(filter: PaymentWebhookListFilter): Promise<{ items: PaymentWebhook[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.provider) items = items.filter((r) => r.provider === filter.provider);
    if (filter.relatedType) items = items.filter((r) => r.relatedType === filter.relatedType);
    if (filter.relatedId) items = items.filter((r) => r.relatedId === filter.relatedId);
    if (filter.from) items = items.filter((r) => r.receivedAt >= filter.from!);
    if (filter.to) items = items.filter((r) => r.receivedAt <= filter.to!);
    items.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return { items: items.slice(start, start + filter.pageSize), total };
  }
}
