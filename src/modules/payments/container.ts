import { walletContainer } from "@/modules/wallet/container";
import { identityContainer } from "@/modules/identity/container";
import { PaymentService } from "@/modules/payments/services/payment.service";
import { GatewayRouterService } from "@/modules/payments/services/gateway-router.service";
import { PrismaDepositRepository } from "@/modules/payments/repositories/deposit.prisma-repository";
import { PrismaWithdrawRepository } from "@/modules/payments/repositories/withdraw.prisma-repository";
import { PrismaPaymentWebhookRepository } from "@/modules/payments/repositories/payment-webhook.prisma-repository";
import { PrismaGatewayCredentialRepository } from "@/modules/payments/repositories/gateway-credential.prisma-repository";
import { PrismaGatewayHealthRepository } from "@/modules/payments/repositories/gateway-health.prisma-repository";
import { PrismaGatewayLogRepository } from "@/modules/payments/repositories/gateway-log.prisma-repository";
import { PrismaPaymentSettingsRepository } from "@/modules/payments/repositories/payment-settings.prisma-repository";
// Guarantees promotionsService.subscribeToDeposits() shares the exact same
// eventBus module instance PaymentService.publish()es depositConfirmed
// through — every src/app/api/payments/**/route.ts imports this container
// (directly or via payments.controller.ts), so this is the one place proven
// to sit in the same Next.js "route handler" compilation layer as the
// publisher. Importing the same module from src/instrumentation.ts's
// register() does NOT work here (see the comment there) — a subscription
// registered in that separate layer never receives events published from a
// route handler.
import "@/modules/promotions/container";

const deposits = new PrismaDepositRepository();
const withdraws = new PrismaWithdrawRepository();
const webhooks = new PrismaPaymentWebhookRepository();
const credentials = new PrismaGatewayCredentialRepository();
const health = new PrismaGatewayHealthRepository();
const logs = new PrismaGatewayLogRepository();
const settings = new PrismaPaymentSettingsRepository();
const router = new GatewayRouterService(credentials, health);

export const paymentsContainer = {
  paymentService: new PaymentService(
    deposits,
    withdraws,
    webhooks,
    credentials,
    logs,
    settings,
    router,
    walletContainer.walletService,
    identityContainer.userRepository
  ),
  gatewayCredentialRepository: credentials,
};
