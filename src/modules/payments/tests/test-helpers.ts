import { encrypt } from "@/server/security/crypto-utils";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { PaymentService } from "@/modules/payments/services/payment.service";
import { GatewayRouterService } from "@/modules/payments/services/gateway-router.service";
import { InMemoryDepositRepository } from "@/modules/payments/repositories/deposit.in-memory-repository";
import { InMemoryWithdrawRepository } from "@/modules/payments/repositories/withdraw.in-memory-repository";
import { InMemoryPaymentWebhookRepository } from "@/modules/payments/repositories/payment-webhook.in-memory-repository";
import { InMemoryGatewayCredentialRepository } from "@/modules/payments/repositories/gateway-credential.in-memory-repository";
import { InMemoryGatewayHealthRepository } from "@/modules/payments/repositories/gateway-health.in-memory-repository";
import { InMemoryGatewayLogRepository } from "@/modules/payments/repositories/gateway-log.in-memory-repository";
import { InMemoryPaymentSettingsRepository } from "@/modules/payments/repositories/payment-settings.in-memory-repository";

export const MOCK_WEBHOOK_SECRET = "test-mock-webhook-secret";

/** Fully-wired PaymentService over in-memory repositories, with one active MOCK gateway pre-registered as the default. Mirrors WalletService's own `buildService()` test helper pattern. */
export async function buildPaymentTestHarness() {
  const wallets = new InMemoryWalletRepository();
  const walletService = new WalletService(wallets);

  const deposits = new InMemoryDepositRepository();
  const withdraws = new InMemoryWithdrawRepository();
  const webhooks = new InMemoryPaymentWebhookRepository();
  const credentials = new InMemoryGatewayCredentialRepository();
  const health = new InMemoryGatewayHealthRepository();
  const logs = new InMemoryGatewayLogRepository();
  const settingsRepo = new InMemoryPaymentSettingsRepository();
  const router = new GatewayRouterService(credentials, health);

  const credential = await credentials.create({
    name: "Mock Gateway",
    provider: "MOCK",
    active: true,
    priority: 0,
    credentialsEncrypted: encrypt("{}"),
    webhookSecretEncrypted: encrypt(MOCK_WEBHOOK_SECRET),
  });
  await settingsRepo.update({ defaultGatewayCredentialId: credential.id, routingMode: "SINGLE" });

  const paymentService = new PaymentService(deposits, withdraws, webhooks, credentials, logs, settingsRepo, router, walletService);

  return { paymentService, walletService, wallets, deposits, withdraws, webhooks, credentials, health, logs, settingsRepo, router, credential };
}
