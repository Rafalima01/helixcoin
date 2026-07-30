import { createChildLogger } from "@/server/logger";
import { decrypt } from "@/server/security/crypto-utils";
import { VeoPagProvider } from "@/modules/payments/providers/veopag/veopag.provider";
import type { IDepositRepository } from "@/modules/payments/interfaces/deposit-repository.interface";
import type { IWithdrawRepository } from "@/modules/payments/interfaces/withdraw-repository.interface";
import type { IGatewayCredentialRepository } from "@/modules/payments/interfaces/gateway-credential-repository.interface";
import type { PaymentService } from "@/modules/payments/services/payment.service";
import type { Deposit, Withdraw } from "@/modules/payments/entities/payments.entity";
import { ProviderFactory } from "@/modules/payments/factories/provider.factory";

const logger = createChildLogger({ module: "payment-reconciliation" });

/** A deposit/withdraw stuck this long in PENDING/PROCESSING is worth a status check — short enough to catch a missed webhook quickly, long enough not to race a delivery that's merely in flight. */
const STUCK_AFTER_MS = 10 * 60_000;

/**
 * Covers the gap MockProvider never had: real gateways' webhooks aren't
 * guaranteed (VeoPag explicitly documents this — one delivery attempt with
 * retries, then it stops, no infinite backoff). This periodically re-checks
 * anything still PENDING/PROCESSING via `provider.getDeposit`/`getWithdraw`
 * and, if the gateway reports it settled, feeds that back through
 * `PaymentService.handleWebhook` using a synthetic-but-genuinely-signed
 * webhook payload (see `VeoPagProvider.buildReconciliationWebhook`) — the
 * exact same validation/idempotency/settlement path a real webhook takes,
 * so there is no second copy of the settlement logic to keep in sync.
 *
 * Only VeoPag needs this today: MOCK never independently changes state
 * outside of `simulateDeposit`/`decideWithdraw`, and every other provider
 * is still `NotImplementedProvider`.
 */
export class PaymentReconciliationService {
  constructor(
    private readonly deposits: IDepositRepository,
    private readonly withdraws: IWithdrawRepository,
    private readonly credentials: IGatewayCredentialRepository,
    private readonly paymentService: PaymentService
  ) {}

  async reconcilePendingDeposits(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    const stuck = await this.deposits.findStuckPending(cutoff);
    for (const deposit of stuck) {
      await this.reconcileDeposit(deposit).catch((err) =>
        logger.error({ err, depositId: deposit.id }, "reconcile deposit failed")
      );
    }
  }

  async reconcilePendingWithdraws(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    const stuck = await this.withdraws.findStuckPending(cutoff);
    for (const withdraw of stuck) {
      await this.reconcileWithdraw(withdraw).catch((err) =>
        logger.error({ err, withdrawId: withdraw.id }, "reconcile withdraw failed")
      );
    }
  }

  private async reconcileDeposit(deposit: Deposit): Promise<void> {
    if (!deposit.providerTransactionId) return;
    const credential = await this.credentials.findById(deposit.gatewayCredentialId);
    if (!credential || credential.provider !== "VEOPAG") return;

    const provider = ProviderFactory.create(credential);
    const result = await provider.getDeposit({ providerTransactionId: deposit.providerTransactionId });
    if (result.status !== "PAID" && result.status !== "FAILED") return;

    const webhookSecret = decrypt(credential.webhookSecretEncrypted);
    const built = VeoPagProvider.buildReconciliationWebhook({
      relatedType: "DEPOSIT",
      providerTransactionId: deposit.providerTransactionId,
      externalId: deposit.id,
      status: result.status === "PAID" ? "COMPLETED" : "FAILED",
      amount: deposit.amountCents / 100,
      webhookSecret,
    });

    logger.info({ depositId: deposit.id, status: result.status }, "reconciled deposit via polling");
    await this.paymentService.handleWebhook("VEOPAG", built.rawBody, built.signatureHeader, built.timestampHeader);
  }

  private async reconcileWithdraw(withdraw: Withdraw): Promise<void> {
    if (!withdraw.providerTransactionId) return;
    const credential = await this.credentials.findById(withdraw.gatewayCredentialId);
    if (!credential || credential.provider !== "VEOPAG") return;

    const provider = ProviderFactory.create(credential);
    const result = await provider.getWithdraw({ providerTransactionId: withdraw.providerTransactionId });
    if (result.status !== "APPROVED" && result.status !== "FAILED") return;

    const webhookSecret = decrypt(credential.webhookSecretEncrypted);
    const built = VeoPagProvider.buildReconciliationWebhook({
      relatedType: "WITHDRAW",
      providerTransactionId: withdraw.providerTransactionId,
      status: result.status === "APPROVED" ? "COMPLETED" : "FAILED",
      amount: withdraw.amountCents / 100,
      webhookSecret,
    });

    logger.info({ withdrawId: withdraw.id, status: result.status }, "reconciled withdraw via polling");
    await this.paymentService.handleWebhook("VEOPAG", built.rawBody, built.signatureHeader, built.timestampHeader);
  }
}
