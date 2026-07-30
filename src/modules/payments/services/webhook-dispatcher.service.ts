import { NotFoundError, UnauthorizedError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { decrypt, sha256Hex } from "@/server/security/crypto-utils";
import { WebhookConflictError } from "@/modules/payments/errors";
import { ProviderFactory } from "@/modules/payments/factories/provider.factory";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import type { IPaymentWebhookRepository } from "@/modules/payments/interfaces/payment-webhook-repository.interface";
import type { IGatewayCredentialRepository } from "@/modules/payments/interfaces/gateway-credential-repository.interface";
import type { IGatewayLogRepository } from "@/modules/payments/interfaces/gateway-log-repository.interface";
import type {
  GatewayCredential,
  GatewayProvider,
  PaymentRelatedType,
  PaymentWebhook,
} from "@/modules/payments/entities/payments.entity";

/** Resolves the internal Deposit/Withdraw id a validated webhook settles — stays with PaymentService since only it knows how to look up either repository. */
export type WebhookRelatedIdResolver = (
  relatedType: PaymentRelatedType,
  providerTransactionId: string
) => Promise<string | null>;

/**
 * The GENERIC half of webhook handling — matching a signed delivery to a
 * registered GatewayCredential (never revealing which one, if any, rejected
 * it), deduping by providerEventId/payloadHash, persisting the
 * PaymentWebhook row, and recovering from a concurrent-insert race. What a
 * given `eventType` actually DOES to the wallet is business logic that
 * stays in PaymentService, injected here as `settle` — this class never
 * needs to change when a new gateway is added. That guarantee doesn't come
 * from this extraction itself: it already existed via
 * `ValidateWebhookResult.eventType` (any provider's `validateWebhook()`
 * translates its native payload into our canonical event vocabulary, e.g.
 * "deposit.paid"). This class only reorganizes where the mechanics live —
 * out of PaymentService's deposit/withdraw business logic, into something
 * independently testable (Fase 10).
 */
export class WebhookDispatcherService {
  constructor(
    private readonly webhooks: IPaymentWebhookRepository,
    private readonly credentials: IGatewayCredentialRepository,
    private readonly logs: IGatewayLogRepository,
    private readonly resolveRelatedId: WebhookRelatedIdResolver,
    private readonly settle: (webhook: PaymentWebhook) => Promise<void>
  ) {}

  /**
   * `POST /api/payments/webhook/{provider}` lands here with the raw request
   * body — signatures are always verified over the raw string, never the
   * parsed JSON. Tries every registered credential for `providerName` until
   * one validates.
   */
  async dispatch(
    providerName: GatewayProvider,
    rawBody: string,
    signatureHeader: string | null,
    timestampHeader?: string | null
  ): Promise<{ status: number }> {
    const payloadHash = sha256Hex(rawBody);
    const candidates = await this.credentials.listByProvider(providerName);

    let matchedCredential: GatewayCredential | null = null;
    let eventType = "";
    let relatedType: PaymentRelatedType | undefined;
    let providerTransactionId: string | undefined;
    let providerEventId: string | undefined;
    let parsedPayload: Record<string, unknown> | undefined;

    for (const credential of candidates) {
      const provider = ProviderFactory.create(credential);
      const webhookSecret = decrypt(credential.webhookSecretEncrypted);
      try {
        const validation = await provider.validateWebhook({ rawBody, signatureHeader, webhookSecret, timestampHeader });
        if (validation.valid) {
          matchedCredential = credential;
          eventType = validation.eventType ?? "";
          relatedType = validation.relatedType;
          providerTransactionId = validation.providerTransactionId;
          providerEventId = validation.providerEventId;
          parsedPayload = validation.parsedPayload;
          break;
        }
      } catch {
        continue; // e.g. NotImplementedProvider — never reveal which credential rejected it
      }
    }

    if (!matchedCredential || !relatedType || !providerTransactionId) {
      throw new UnauthorizedError("Assinatura de webhook inválida");
    }

    const existing = await this.findExistingWebhook(providerEventId, payloadHash);
    if (existing) {
      eventBus.publish(PAYMENT_EVENTS.webhookDuplicate, {
        webhookId: existing.id,
        provider: matchedCredential.provider,
        eventType: existing.eventType,
        relatedId: existing.relatedId,
      });
      if (existing.status === "PROCESSED" || existing.status === "REPROCESSED") {
        return { status: existing.responseStatus ?? 200 };
      }
    }

    const relatedId = await this.resolveRelatedId(relatedType, providerTransactionId);
    if (!relatedId) throw new NotFoundError(relatedType === "DEPOSIT" ? "Depósito" : "Saque");

    let webhook: PaymentWebhook;
    if (existing) {
      webhook = existing;
    } else {
      try {
        webhook = await this.webhooks.create({
          gatewayCredentialId: matchedCredential.id,
          provider: matchedCredential.provider,
          relatedType,
          relatedId,
          eventType,
          providerEventId: providerEventId ?? null,
          payloadHash,
          payload: parsedPayload ?? JSON.parse(rawBody),
          signatureValid: true,
        });
      } catch (err) {
        // A concurrent delivery of the SAME event won the race and already created the row — defer to it instead of erroring.
        if (err instanceof WebhookConflictError && providerEventId) {
          const winner = await this.webhooks.findByProviderEventId(providerEventId);
          if (!winner) throw err;
          if (winner.status === "PROCESSED" || winner.status === "REPROCESSED") {
            return { status: winner.responseStatus ?? 200 };
          }
          webhook = winner;
        } else {
          throw err;
        }
      }
    }

    eventBus.publish(PAYMENT_EVENTS.webhookReceived, {
      webhookId: webhook.id,
      provider: matchedCredential.provider,
      eventType,
      relatedType,
      relatedId,
    });

    return this.settleAndRecord(webhook, matchedCredential, !!existing);
  }

  /** Admin "Reprocessar" action on a stored webhook — re-runs settlement from the already-verified, already-stored payload without needing a fresh signature. */
  async reprocess(webhookId: string): Promise<{ status: number }> {
    const webhook = await this.webhooks.findById(webhookId);
    if (!webhook) throw new NotFoundError("Webhook");
    const credential = await this.credentials.findById(webhook.gatewayCredentialId);
    if (!credential) throw new NotFoundError("Gateway");
    return this.settleAndRecord(webhook, credential, true);
  }

  private async findExistingWebhook(
    providerEventId: string | undefined,
    payloadHash: string
  ): Promise<PaymentWebhook | null> {
    if (providerEventId) {
      const byEventId = await this.webhooks.findByProviderEventId(providerEventId);
      if (byEventId) return byEventId;
    }
    return this.webhooks.findByPayloadHash(payloadHash);
  }

  private async settleAndRecord(
    webhook: PaymentWebhook,
    credential: GatewayCredential,
    isReprocess: boolean
  ): Promise<{ status: number }> {
    const start = performance.now();
    try {
      await this.settle(webhook);
      const processingMs = Math.round(performance.now() - start);
      await this.webhooks.update(webhook.id, {
        status: isReprocess ? "REPROCESSED" : "PROCESSED",
        responseStatus: 200,
        responseBody: { ok: true },
        processedAt: new Date(),
        ...(isReprocess ? { reprocessedAt: new Date(), reprocessCount: webhook.reprocessCount + 1 } : {}),
        processingMs,
      });
      await this.logInbound({
        credential,
        success: true,
        statusCode: 200,
        durationMs: processingMs,
        correlationId: webhook.relatedId,
      });
      return { status: 200 };
    } catch (err) {
      const processingMs = Math.round(performance.now() - start);
      const errorMessage = err instanceof Error ? err.message : "unknown error";
      await this.webhooks.update(webhook.id, {
        status: "ERROR",
        responseStatus: 500,
        errorMessage,
        processedAt: new Date(),
        ...(isReprocess ? { reprocessedAt: new Date(), reprocessCount: webhook.reprocessCount + 1 } : {}),
        processingMs,
      });
      await this.logInbound({
        credential,
        success: false,
        statusCode: 500,
        durationMs: processingMs,
        errorMessage,
        correlationId: webhook.relatedId,
      });
      return { status: 500 };
    }
  }

  private async logInbound(input: {
    credential: GatewayCredential;
    success: boolean;
    statusCode: number;
    durationMs: number;
    correlationId: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.logs.create({
        gatewayCredentialId: input.credential.id,
        provider: input.credential.provider,
        direction: "inbound",
        endpoint: `/api/payments/webhook/${input.credential.provider}`,
        success: input.success,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage ?? null,
        correlationId: input.correlationId,
        requestSummary: { correlationId: input.correlationId },
      });
    } catch {
      // Logging must never break the webhook flow itself.
    }
  }
}
