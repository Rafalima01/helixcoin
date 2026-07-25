import { walletContainer } from "@/modules/wallet/container";
import { PaymentService } from "@/modules/payments/services/payment.service";
import { GatewayRouterService } from "@/modules/payments/services/gateway-router.service";
import { PrismaDepositRepository } from "@/modules/payments/repositories/deposit.prisma-repository";
import { PrismaWithdrawRepository } from "@/modules/payments/repositories/withdraw.prisma-repository";
import { PrismaPaymentWebhookRepository } from "@/modules/payments/repositories/payment-webhook.prisma-repository";
import { PrismaGatewayCredentialRepository } from "@/modules/payments/repositories/gateway-credential.prisma-repository";
import { PrismaGatewayHealthRepository } from "@/modules/payments/repositories/gateway-health.prisma-repository";
import { PrismaGatewayLogRepository } from "@/modules/payments/repositories/gateway-log.prisma-repository";
import { PrismaPaymentSettingsRepository } from "@/modules/payments/repositories/payment-settings.prisma-repository";

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
    walletContainer.walletService
  ),
  gatewayCredentialRepository: credentials,
};
