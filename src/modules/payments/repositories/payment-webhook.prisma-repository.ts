import { Prisma } from "@prisma/client";
import type { PaymentWebhook as PrismaPaymentWebhook } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WebhookConflictError } from "@/modules/payments/errors";
import type {
  IPaymentWebhookRepository,
  CreatePaymentWebhookInput,
  UpdatePaymentWebhookInput,
  PaymentWebhookListFilter,
} from "@/modules/payments/interfaces/payment-webhook-repository.interface";
import type { PaymentWebhook } from "@/modules/payments/entities/payments.entity";

function toEntity(row: PrismaPaymentWebhook): PaymentWebhook {
  return {
    id: row.id,
    gatewayCredentialId: row.gatewayCredentialId,
    provider: row.provider,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    eventType: row.eventType,
    status: row.status,
    providerEventId: row.providerEventId,
    payloadHash: row.payloadHash,
    payload: row.payload as Record<string, unknown>,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody as Record<string, unknown> | null,
    signatureValid: row.signatureValid,
    errorMessage: row.errorMessage,
    receivedAt: row.receivedAt,
    processedAt: row.processedAt,
    reprocessedAt: row.reprocessedAt,
    reprocessCount: row.reprocessCount,
    processingMs: row.processingMs,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaPaymentWebhookRepository implements IPaymentWebhookRepository {
  async create(input: CreatePaymentWebhookInput): Promise<PaymentWebhook> {
    try {
      const row = await prisma.paymentWebhook.create({
        data: {
          id: input.id ?? crypto.randomUUID(),
          gatewayCredentialId: input.gatewayCredentialId,
          provider: input.provider,
          relatedType: input.relatedType,
          relatedId: input.relatedId,
          eventType: input.eventType,
          status: input.status ?? "RECEIVED",
          providerEventId: input.providerEventId ?? null,
          payloadHash: input.payloadHash,
          payload: toJson(input.payload),
          signatureValid: input.signatureValid,
        },
      });
      return toEntity(row);
    } catch (err) {
      // A concurrent delivery of the SAME event won the race and committed first — recovered by PaymentService, never surfaced as a generic conflict.
      if (
        input.providerEventId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("providerEventId")
      ) {
        throw new WebhookConflictError(input.providerEventId);
      }
      throw err;
    }
  }

  async findById(id: string): Promise<PaymentWebhook | null> {
    const row = await prisma.paymentWebhook.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByProviderEventId(providerEventId: string): Promise<PaymentWebhook | null> {
    const row = await prisma.paymentWebhook.findUnique({ where: { providerEventId } });
    return row ? toEntity(row) : null;
  }

  async findByPayloadHash(payloadHash: string): Promise<PaymentWebhook | null> {
    const row = await prisma.paymentWebhook.findFirst({ where: { payloadHash }, orderBy: { receivedAt: "desc" } });
    return row ? toEntity(row) : null;
  }

  async update(id: string, input: UpdatePaymentWebhookInput): Promise<PaymentWebhook> {
    const row = await prisma.paymentWebhook.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.responseStatus !== undefined ? { responseStatus: input.responseStatus } : {}),
        ...(input.responseBody !== undefined
          ? { responseBody: input.responseBody !== null ? toJson(input.responseBody) : Prisma.JsonNull }
          : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        ...(input.processedAt !== undefined ? { processedAt: input.processedAt } : {}),
        ...(input.reprocessedAt !== undefined ? { reprocessedAt: input.reprocessedAt } : {}),
        ...(input.reprocessCount !== undefined ? { reprocessCount: input.reprocessCount } : {}),
        ...(input.processingMs !== undefined ? { processingMs: input.processingMs } : {}),
      },
    });
    return toEntity(row);
  }

  async listAdmin(filter: PaymentWebhookListFilter): Promise<{ items: PaymentWebhook[]; total: number }> {
    const where: Prisma.PaymentWebhookWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.provider ? { provider: filter.provider } : {}),
      ...(filter.relatedType ? { relatedType: filter.relatedType } : {}),
      ...(filter.relatedId ? { relatedId: filter.relatedId } : {}),
      ...(filter.from || filter.to
        ? { receivedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.paymentWebhook.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.paymentWebhook.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
