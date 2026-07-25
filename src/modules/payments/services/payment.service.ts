import { BusinessRuleError, ExternalServiceError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { encrypt, decrypt, sha256Hex } from "@/server/security/crypto-utils";
import { WebhookConflictError } from "@/modules/payments/errors";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { ProviderFactory } from "@/modules/payments/factories/provider.factory";
import { GatewayRouterService } from "@/modules/payments/services/gateway-router.service";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import { PAYMENT_IDEMPOTENCY_KEYS, maskPixKey } from "@/modules/payments/constants/payments.constants";
import type { IDepositRepository } from "@/modules/payments/interfaces/deposit-repository.interface";
import type { IWithdrawRepository } from "@/modules/payments/interfaces/withdraw-repository.interface";
import type { IPaymentWebhookRepository } from "@/modules/payments/interfaces/payment-webhook-repository.interface";
import type {
  IGatewayCredentialRepository,
  CreateGatewayCredentialInput,
  UpdateGatewayCredentialInput,
} from "@/modules/payments/interfaces/gateway-credential-repository.interface";
import type { IGatewayLogRepository } from "@/modules/payments/interfaces/gateway-log-repository.interface";
import type { IPaymentSettingsRepository, UpdatePaymentSettingsInput } from "@/modules/payments/interfaces/payment-settings-repository.interface";
import type { PaymentProvider } from "@/modules/payments/interfaces/payment-provider.interface";
import type {
  Deposit,
  DepositAdminRow,
  WithdrawAdminRow,
  DepositStatus,
  GatewayCredential,
  GatewayCredentialWithHealth,
  PaymentWebhook,
  PaymentSettings,
  GatewayProvider,
  PaymentRelatedType,
} from "@/modules/payments/entities/payments.entity";
import type { DepositListFilter } from "@/modules/payments/interfaces/deposit-repository.interface";
import type { WithdrawListFilter } from "@/modules/payments/interfaces/withdraw-repository.interface";
import type { PaymentWebhookListFilter } from "@/modules/payments/interfaces/payment-webhook-repository.interface";
import type { GatewayLogListFilter } from "@/modules/payments/interfaces/gateway-log-repository.interface";
import type { GatewayCredentialListFilter } from "@/modules/payments/interfaces/gateway-credential-repository.interface";

export interface CreateDepositResult {
  depositId: string;
  pixCode: string;
  qrCodeUrl: string | null;
  expiresAt: string | null;
  amountCents: number;
  status: DepositStatus;
}

export interface RequestWithdrawResult {
  withdrawId: string;
  status: string;
  amountCents: number;
}

const SYSTEM_ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };

/**
 * The financial core's only bridge to the outside world. Never moves a
 * balance itself — every confirmed deposit or approved/rejected withdraw
 * calls into `WalletService` (credit/debit/lock/unlock), which stays the
 * sole writer of Wallet balances (see that module's README). This class
 * owns: gateway selection + failover (via GatewayRouterService), the
 * Deposit/Withdraw/PaymentWebhook lifecycle, and webhook signature
 * verification + idempotent settlement.
 */
export class PaymentService {
  constructor(
    private readonly deposits: IDepositRepository,
    private readonly withdraws: IWithdrawRepository,
    private readonly webhooks: IPaymentWebhookRepository,
    private readonly credentials: IGatewayCredentialRepository,
    private readonly logs: IGatewayLogRepository,
    private readonly settingsRepo: IPaymentSettingsRepository,
    private readonly router: GatewayRouterService,
    private readonly walletService: WalletService
  ) {}

  // -------------------------------------------------------------- deposits

  async createDeposit(userId: string, amountCents: number): Promise<CreateDepositResult> {
    const settings = await this.settingsRepo.get();
    if (amountCents < settings.depositMinCents || amountCents > settings.depositMaxCents) {
      throw new BusinessRuleError(
        `Valor deve estar entre ${settings.depositMinCents / 100} e ${settings.depositMaxCents / 100}`
      );
    }

    const depositId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + settings.pixExpirationMinutes * 60_000);

    const { credential, result } = await this.withFailover(
      settings,
      "/api/payments/deposits",
      depositId,
      (provider) => provider.createPixDeposit({ depositId, amountCents, expiresAt })
    );

    const deposit = await this.deposits.create({
      id: depositId,
      userId,
      gatewayCredentialId: credential.id,
      amountCents,
      status: "PENDING",
      providerTransactionId: result.providerTransactionId,
      pixCode: result.pixCode,
      qrCodeUrl: result.qrCodeUrl ?? null,
      expiresAt: result.expiresAt,
    });

    eventBus.publish(PAYMENT_EVENTS.depositCreated, {
      depositId: deposit.id,
      userId,
      amountCents,
      gatewayCredentialId: credential.id,
      status: deposit.status,
    });
    eventBus.publish(PAYMENT_EVENTS.depositPending, {
      depositId: deposit.id,
      userId,
      amountCents,
      gatewayCredentialId: credential.id,
      status: deposit.status,
    });

    return {
      depositId: deposit.id,
      pixCode: deposit.pixCode!,
      qrCodeUrl: deposit.qrCodeUrl,
      expiresAt: deposit.expiresAt ? deposit.expiresAt.toISOString() : null,
      amountCents: deposit.amountCents,
      status: deposit.status,
    };
  }

  async getDeposit(depositId: string, userId: string): Promise<Deposit> {
    const deposit = await this.deposits.findById(depositId);
    if (!deposit) throw new NotFoundError("Depósito");
    if (deposit.userId !== userId) throw new ForbiddenError();
    return deposit;
  }

  /** Player-facing Mock-only demo action — guarded to the MOCK provider, builds a real signed webhook payload and settles it through the exact same path a real webhook would. */
  async simulateDeposit(depositId: string, userId: string, outcome: "PAID" | "FAILED"): Promise<{ status: number }> {
    const deposit = await this.deposits.findById(depositId);
    if (!deposit) throw new NotFoundError("Depósito");
    if (deposit.userId !== userId) throw new ForbiddenError();
    if (deposit.status !== "PENDING") throw new BusinessRuleError("Depósito já processado");

    const credential = await this.credentials.findById(deposit.gatewayCredentialId);
    if (!credential || credential.provider !== "MOCK") {
      throw new BusinessRuleError("Simulação disponível apenas para o gateway MOCK");
    }

    const webhookSecret = decrypt(credential.webhookSecretEncrypted);
    const built = MockProvider.buildWebhookPayload({
      eventType: outcome === "PAID" ? "deposit.paid" : "deposit.failed",
      relatedType: "DEPOSIT",
      relatedId: deposit.id,
      providerTransactionId: deposit.providerTransactionId ?? `mock_dep_${deposit.id}`,
      webhookSecret,
    });

    return this.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);
  }

  // ------------------------------------------------------------- withdraws

  async requestWithdraw(
    userId: string,
    amountCents: number,
    pixKey: string,
    pixKeyType: string | undefined,
    actor: WalletActor
  ): Promise<RequestWithdrawResult> {
    const settings = await this.settingsRepo.get();
    if (amountCents < settings.withdrawMinCents || amountCents > settings.withdrawMaxCents) {
      throw new BusinessRuleError(
        `Valor deve estar entre ${settings.withdrawMinCents / 100} e ${settings.withdrawMaxCents / 100}`
      );
    }

    const withdrawId = crypto.randomUUID();

    const locked = await this.walletService.lock({
      userId,
      amountCents,
      type: "WITHDRAW_PENDING",
      origin: "payments",
      originId: withdrawId,
      idempotencyKey: PAYMENT_IDEMPOTENCY_KEYS.withdrawLock(withdrawId),
      metadata: { pixKeyMasked: maskPixKey(pixKey) },
      actor,
    });

    let credential: GatewayCredential;
    let providerTransactionId: string;
    try {
      const outcome = await this.withFailover(settings, "/api/payments/withdrawals", withdrawId, (provider) =>
        provider.createWithdraw({ withdrawId, amountCents, pixKey, pixKeyType })
      );
      credential = outcome.credential;
      providerTransactionId = outcome.result.providerTransactionId;
    } catch (err) {
      // Every candidate gateway rejected the request — never leave funds stuck locked with no gateway holding it.
      await this.walletService.unlock({
        userId,
        amountCents,
        type: "WITHDRAW_REJECTED",
        origin: "payments",
        originId: withdrawId,
        idempotencyKey: PAYMENT_IDEMPOTENCY_KEYS.withdrawUnlockProviderFailure(withdrawId),
        metadata: { reason: "gateway_unavailable" },
        actor: SYSTEM_ACTOR,
      });
      throw err;
    }

    const withdraw = await this.withdraws.create({
      id: withdrawId,
      userId,
      gatewayCredentialId: credential.id,
      amountCents,
      status: "PENDING",
      pixKeyEncrypted: encrypt(pixKey),
      pixKeyType: pixKeyType ?? null,
      providerTransactionId,
      lockWalletTransactionId: locked.transaction.id,
    });

    eventBus.publish(PAYMENT_EVENTS.withdrawRequested, {
      withdrawId: withdraw.id,
      userId,
      amountCents,
      gatewayCredentialId: credential.id,
      status: withdraw.status,
    });

    return { withdrawId: withdraw.id, status: withdraw.status, amountCents };
  }

  /** Admin-only Mock-only decision action — same "build a real signed webhook payload, settle through handleWebhook" pattern as simulateDeposit. */
  async decideWithdraw(
    withdrawId: string,
    action: "APPROVE" | "REJECT",
    rejectionReason: string | undefined
  ): Promise<{ status: number }> {
    const withdraw = await this.withdraws.findById(withdrawId);
    if (!withdraw) throw new NotFoundError("Saque");
    if (withdraw.status !== "PENDING") throw new BusinessRuleError("Saque já processado");

    const credential = await this.credentials.findById(withdraw.gatewayCredentialId);
    if (!credential || credential.provider !== "MOCK") {
      throw new BusinessRuleError("Simulação disponível apenas para o gateway MOCK");
    }

    const webhookSecret = decrypt(credential.webhookSecretEncrypted);
    const built = MockProvider.buildWebhookPayload({
      eventType: action === "APPROVE" ? "withdraw.approved" : "withdraw.rejected",
      relatedType: "WITHDRAW",
      relatedId: withdraw.id,
      providerTransactionId: withdraw.providerTransactionId ?? `mock_wd_${withdraw.id}`,
      webhookSecret,
      extra: action === "REJECT" ? { rejectionReason } : undefined,
    });

    return this.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);
  }

  // -------------------------------------------------------------- webhooks

  /**
   * `POST /api/payments/webhook/{provider}` lands here with the raw request
   * body — signatures are always verified over the raw string, never the
   * parsed JSON. Tries every registered credential for `providerName` until
   * one validates (never reveals which check failed, if any).
   */
  async handleWebhook(
    providerName: GatewayProvider,
    rawBody: string,
    signatureHeader: string | null
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
        const validation = await provider.validateWebhook({ rawBody, signatureHeader, webhookSecret });
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
    if (existing && (existing.status === "PROCESSED" || existing.status === "REPROCESSED")) {
      return { status: existing.responseStatus ?? 200 };
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
  async reprocessWebhook(webhookId: string): Promise<{ status: number }> {
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

  private async resolveRelatedId(relatedType: PaymentRelatedType, providerTransactionId: string): Promise<string | null> {
    if (relatedType === "DEPOSIT") {
      const deposit = await this.deposits.findByProviderTransactionId(providerTransactionId);
      return deposit?.id ?? null;
    }
    const withdraw = await this.withdraws.findByProviderTransactionId(providerTransactionId);
    return withdraw?.id ?? null;
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
      await this.logGateway({
        direction: "inbound",
        endpoint: `/api/payments/webhook/${credential.provider}`,
        provider: credential.provider,
        gatewayCredentialId: credential.id,
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
      await this.logGateway({
        direction: "inbound",
        endpoint: `/api/payments/webhook/${credential.provider}`,
        provider: credential.provider,
        gatewayCredentialId: credential.id,
        success: false,
        statusCode: 500,
        durationMs: processingMs,
        errorMessage,
        correlationId: webhook.relatedId,
      });
      return { status: 500 };
    }
  }

  /**
   * The settlement idempotency-key scheme, parallel to match-engine's
   * `match:{id}:bet` convention:
   *   deposit.paid              -> credit()                       deposit:{id}:confirm
   *   deposit.failed/cancelled/
   *   expired                   -> Deposit status update only      (none)
   *   withdraw.approved         -> debit(account:"LOCKED")         withdraw:{id}:approve
   *   withdraw.rejected         -> unlock()                        withdraw:{id}:unlock-reject
   * Every branch is itself defensively idempotent (checks the current
   * Deposit/Withdraw status before acting) on top of WalletService's own
   * idempotency-key guarantee — belt and suspenders for a reprocessed or
   * replayed webhook.
   */
  private async settle(webhook: PaymentWebhook): Promise<void> {
    switch (webhook.eventType) {
      case "deposit.paid": {
        const deposit = await this.deposits.findById(webhook.relatedId);
        if (!deposit) throw new NotFoundError("Depósito");
        if (deposit.status === "PAID") return;

        const result = await this.walletService.credit({
          userId: deposit.userId,
          amountCents: deposit.amountCents,
          type: "DEPOSIT",
          origin: "payments",
          originId: deposit.id,
          idempotencyKey: PAYMENT_IDEMPOTENCY_KEYS.depositConfirm(deposit.id),
          metadata: { gatewayCredentialId: deposit.gatewayCredentialId, provider: webhook.provider },
          actor: SYSTEM_ACTOR,
        });

        await this.deposits.update(deposit.id, {
          status: "PAID",
          walletTransactionId: result.transaction.id,
          confirmedAt: new Date(),
        });
        eventBus.publish(PAYMENT_EVENTS.depositConfirmed, {
          depositId: deposit.id,
          userId: deposit.userId,
          amountCents: deposit.amountCents,
          gatewayCredentialId: deposit.gatewayCredentialId,
          status: "PAID",
        });
        return;
      }

      case "deposit.failed":
      case "deposit.cancelled":
      case "deposit.expired": {
        const deposit = await this.deposits.findById(webhook.relatedId);
        if (!deposit) throw new NotFoundError("Depósito");
        if (deposit.status !== "PENDING" && deposit.status !== "PROCESSING") return;

        const statusMap: Record<string, DepositStatus> = {
          "deposit.failed": "FAILED",
          "deposit.cancelled": "CANCELLED",
          "deposit.expired": "EXPIRED",
        };
        const reason = (webhook.payload as { reason?: string }).reason ?? null;
        await this.deposits.update(deposit.id, { status: statusMap[webhook.eventType], failureReason: reason });
        eventBus.publish(PAYMENT_EVENTS.depositFailed, {
          depositId: deposit.id,
          userId: deposit.userId,
          amountCents: deposit.amountCents,
          gatewayCredentialId: deposit.gatewayCredentialId,
          status: statusMap[webhook.eventType],
        });
        return;
      }

      case "withdraw.approved": {
        const withdraw = await this.withdraws.findById(webhook.relatedId);
        if (!withdraw) throw new NotFoundError("Saque");
        if (withdraw.status !== "PENDING" && withdraw.status !== "PROCESSING") return;

        const result = await this.walletService.debit({
          userId: withdraw.userId,
          amountCents: withdraw.amountCents,
          type: "WITHDRAW_APPROVED",
          account: "LOCKED",
          origin: "payments",
          originId: withdraw.id,
          idempotencyKey: PAYMENT_IDEMPOTENCY_KEYS.withdrawApprove(withdraw.id),
          actor: SYSTEM_ACTOR,
        });

        await this.withdraws.update(withdraw.id, {
          status: "APPROVED",
          settleWalletTransactionId: result.transaction.id,
          processedAt: new Date(),
        });
        eventBus.publish(PAYMENT_EVENTS.withdrawApproved, {
          withdrawId: withdraw.id,
          userId: withdraw.userId,
          amountCents: withdraw.amountCents,
          gatewayCredentialId: withdraw.gatewayCredentialId,
          status: "APPROVED",
        });
        return;
      }

      case "withdraw.rejected": {
        const withdraw = await this.withdraws.findById(webhook.relatedId);
        if (!withdraw) throw new NotFoundError("Saque");
        if (withdraw.status !== "PENDING" && withdraw.status !== "PROCESSING") return;

        await this.walletService.unlock({
          userId: withdraw.userId,
          amountCents: withdraw.amountCents,
          type: "WITHDRAW_REJECTED",
          origin: "payments",
          originId: withdraw.id,
          idempotencyKey: PAYMENT_IDEMPOTENCY_KEYS.withdrawUnlockReject(withdraw.id),
          actor: SYSTEM_ACTOR,
        });

        const rejectionReason = (webhook.payload as { rejectionReason?: string }).rejectionReason ?? null;
        await this.withdraws.update(withdraw.id, {
          status: "REJECTED",
          rejectionReason,
          processedAt: new Date(),
        });
        eventBus.publish(PAYMENT_EVENTS.withdrawRejected, {
          withdrawId: withdraw.id,
          userId: withdraw.userId,
          amountCents: withdraw.amountCents,
          gatewayCredentialId: withdraw.gatewayCredentialId,
          status: "REJECTED",
        });
        return;
      }

      default:
        throw new BusinessRuleError(`Evento de webhook desconhecido: ${webhook.eventType}`);
    }
  }

  // ---------------------------------------------------------- gateway I/O

  /** Tries every routable, healthy candidate in order; records a GatewayLog row per attempt and a fresh health check on failure so the next call's routing already reflects it. */
  private async withFailover<T>(
    settings: PaymentSettings,
    endpoint: string,
    correlationId: string,
    fn: (provider: PaymentProvider) => Promise<T>
  ): Promise<{ credential: GatewayCredential; result: T }> {
    const ordered = await this.router.resolveCandidates(settings);
    const healthy = await this.router.filterHealthy(ordered);
    const candidates = healthy.length > 0 ? healthy : ordered;
    if (candidates.length === 0) throw new BusinessRuleError("Nenhum gateway de pagamento ativo configurado");

    let lastError: unknown;
    for (const credential of candidates) {
      const provider = ProviderFactory.create(credential);
      const start = performance.now();
      try {
        const result = await fn(provider);
        const durationMs = Math.round(performance.now() - start);
        await this.logGateway({
          direction: "outbound",
          endpoint,
          provider: credential.provider,
          gatewayCredentialId: credential.id,
          success: true,
          durationMs,
          correlationId,
        });
        return { credential, result };
      } catch (err) {
        lastError = err;
        const durationMs = Math.round(performance.now() - start);
        await this.logGateway({
          direction: "outbound",
          endpoint,
          provider: credential.provider,
          gatewayCredentialId: credential.id,
          success: false,
          durationMs,
          correlationId,
          errorMessage: err instanceof Error ? err.message : "unknown error",
        });
        await this.router.recordHealthCheck(credential).catch(() => {});
      }
    }

    throw lastError instanceof Error
      ? new ExternalServiceError("payments", lastError.message)
      : new ExternalServiceError("payments");
  }

  private async logGateway(input: {
    direction: "outbound" | "inbound";
    endpoint: string;
    provider?: GatewayProvider | null;
    gatewayCredentialId?: string | null;
    success: boolean;
    durationMs?: number;
    statusCode?: number;
    correlationId?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.logs.create({
        gatewayCredentialId: input.gatewayCredentialId ?? null,
        provider: input.provider ?? null,
        direction: input.direction,
        endpoint: input.endpoint,
        success: input.success,
        durationMs: input.durationMs ?? null,
        statusCode: input.statusCode ?? null,
        errorMessage: input.errorMessage ?? null,
        correlationId: input.correlationId ?? null,
        requestSummary: input.correlationId ? { correlationId: input.correlationId } : null,
      });
    } catch {
      // Logging must never break the payment flow itself.
    }
  }

  // ------------------------------------------------------------- admin

  async listDepositsAdmin(filter: DepositListFilter) {
    return this.deposits.listAdmin(filter);
  }

  async getDepositAdmin(id: string): Promise<DepositAdminRow> {
    const deposit = await this.deposits.findByIdAdmin(id);
    if (!deposit) throw new NotFoundError("Depósito");
    return deposit;
  }

  async listWithdrawsAdmin(filter: WithdrawListFilter) {
    const { items, total } = await this.withdraws.listAdmin(filter);
    return {
      items: items.map((row) => ({ row, pixKeyMasked: maskPixKey(decrypt(row.pixKeyEncrypted)) })),
      total,
    };
  }

  async getWithdrawAdmin(id: string): Promise<{ withdraw: WithdrawAdminRow; pixKeyMasked: string }> {
    const withdraw = await this.withdraws.findByIdAdmin(id);
    if (!withdraw) throw new NotFoundError("Saque");
    return { withdraw, pixKeyMasked: maskPixKey(decrypt(withdraw.pixKeyEncrypted)) };
  }

  async listWebhooksAdmin(filter: PaymentWebhookListFilter) {
    return this.webhooks.listAdmin(filter);
  }

  async getWebhookAdmin(id: string): Promise<PaymentWebhook> {
    const webhook = await this.webhooks.findById(id);
    if (!webhook) throw new NotFoundError("Webhook");
    return webhook;
  }

  async listGatewayLogsAdmin(filter: GatewayLogListFilter) {
    return this.logs.listAdmin(filter);
  }

  async listGatewaysAdmin(filter: GatewayCredentialListFilter): Promise<{ items: GatewayCredentialWithHealth[]; total: number }> {
    return this.credentials.listAdmin(filter);
  }

  async getGatewayAdmin(id: string): Promise<GatewayCredentialWithHealth> {
    const credential = await this.credentials.findById(id);
    if (!credential) throw new NotFoundError("Gateway");
    const { items } = await this.credentials.listAdmin({ page: 1, pageSize: 1000 });
    return items.find((c) => c.id === id) ?? { ...credential, latestHealth: null };
  }

  async createGateway(input: {
    name: string;
    provider: GatewayProvider;
    mode?: "SANDBOX" | "PRODUCTION";
    credentials: Record<string, unknown>;
    webhookSecret: string;
    active?: boolean;
    priority?: number;
    weight?: number;
    timeoutMs?: number;
    maxRetries?: number;
    simulatedHealth?: GatewayCredential["simulatedHealth"];
    createdById: string;
  }): Promise<GatewayCredential> {
    const payload: CreateGatewayCredentialInput = {
      name: input.name,
      provider: input.provider,
      mode: input.mode,
      active: input.active,
      priority: input.priority,
      weight: input.weight,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      credentialsEncrypted: encrypt(JSON.stringify(input.credentials)),
      webhookSecretEncrypted: encrypt(input.webhookSecret),
      simulatedHealth: input.simulatedHealth ?? null,
      createdById: input.createdById,
    };
    return this.credentials.create(payload);
  }

  async updateGateway(
    id: string,
    input: {
      name?: string;
      mode?: "SANDBOX" | "PRODUCTION";
      credentials?: Record<string, unknown>;
      webhookSecret?: string;
      active?: boolean;
      priority?: number;
      weight?: number;
      timeoutMs?: number;
      maxRetries?: number;
      simulatedHealth?: GatewayCredential["simulatedHealth"];
    }
  ): Promise<GatewayCredential> {
    const existing = await this.credentials.findById(id);
    if (!existing) throw new NotFoundError("Gateway");

    const payload: UpdateGatewayCredentialInput = {
      name: input.name,
      mode: input.mode,
      active: input.active,
      priority: input.priority,
      weight: input.weight,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      simulatedHealth: input.simulatedHealth,
      ...(input.credentials !== undefined ? { credentialsEncrypted: encrypt(JSON.stringify(input.credentials)) } : {}),
      ...(input.webhookSecret !== undefined ? { webhookSecretEncrypted: encrypt(input.webhookSecret) } : {}),
    };
    return this.credentials.update(id, payload);
  }

  async testGatewayConnection(id: string) {
    const credential = await this.credentials.findById(id);
    if (!credential) throw new NotFoundError("Gateway");
    return this.router.recordHealthCheck(credential);
  }

  async getSettings(): Promise<PaymentSettings> {
    return this.settingsRepo.get();
  }

  async updateSettings(input: UpdatePaymentSettingsInput): Promise<PaymentSettings> {
    return this.settingsRepo.update(input);
  }
}
