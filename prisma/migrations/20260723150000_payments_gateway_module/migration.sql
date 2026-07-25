-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('MOCK', 'CARTPANDA', 'CARTWAVEHUB', 'MERCADO_PAGO', 'PAY4FUN', 'BSPAY', 'PAY2M', 'OPENPIX', 'OUTROS');

-- CreateEnum
CREATE TYPE "GatewayMode" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "RoutingMode" AS ENUM ('SINGLE', 'ROUND_ROBIN', 'WEIGHTED', 'FAILOVER');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WithdrawStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'ERROR', 'REPROCESSED');

-- CreateEnum
CREATE TYPE "GatewayHealthStatus" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "PaymentRelatedType" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateTable
CREATE TABLE "GatewayCredential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "mode" "GatewayMode" NOT NULL DEFAULT 'SANDBOX',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "credentialsEncrypted" TEXT NOT NULL,
    "webhookSecretEncrypted" TEXT NOT NULL,
    "simulatedHealth" "GatewayHealthStatus",
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gatewayCredentialId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "providerTransactionId" TEXT,
    "pixCode" TEXT,
    "qrCodeUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "walletTransactionId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdraw" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gatewayCredentialId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "WithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "pixKeyEncrypted" TEXT NOT NULL,
    "pixKeyType" TEXT,
    "providerTransactionId" TEXT,
    "lockWalletTransactionId" TEXT,
    "settleWalletTransactionId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhook" (
    "id" TEXT NOT NULL,
    "gatewayCredentialId" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "relatedType" "PaymentRelatedType" NOT NULL,
    "relatedId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "providerEventId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "reprocessedAt" TIMESTAMP(3),
    "reprocessCount" INTEGER NOT NULL DEFAULT 0,
    "processingMs" INTEGER,

    CONSTRAINT "PaymentWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayHealth" (
    "id" TEXT NOT NULL,
    "gatewayCredentialId" TEXT NOT NULL,
    "status" "GatewayHealthStatus" NOT NULL,
    "latencyMs" INTEGER,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayLog" (
    "id" TEXT NOT NULL,
    "gatewayCredentialId" TEXT,
    "provider" "GatewayProvider",
    "direction" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT,
    "requestSummary" JSONB,
    "responseSummary" JSONB,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "defaultGatewayCredentialId" TEXT,
    "routingMode" "RoutingMode" NOT NULL DEFAULT 'SINGLE',
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "pixExpirationMinutes" INTEGER NOT NULL DEFAULT 30,
    "depositMinCents" INTEGER NOT NULL DEFAULT 500,
    "depositMaxCents" INTEGER NOT NULL DEFAULT 1000000,
    "withdrawMinCents" INTEGER NOT NULL DEFAULT 1000,
    "withdrawMaxCents" INTEGER NOT NULL DEFAULT 1000000,
    "maxWebhookProcessingMs" INTEGER NOT NULL DEFAULT 5000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GatewayCredential_provider_idx" ON "GatewayCredential"("provider");

-- CreateIndex
CREATE INDEX "GatewayCredential_active_idx" ON "GatewayCredential"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_providerTransactionId_key" ON "Deposit"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_walletTransactionId_key" ON "Deposit"("walletTransactionId");

-- CreateIndex
CREATE INDEX "Deposit_userId_status_idx" ON "Deposit"("userId", "status");

-- CreateIndex
CREATE INDEX "Deposit_gatewayCredentialId_idx" ON "Deposit"("gatewayCredentialId");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE INDEX "Deposit_createdAt_idx" ON "Deposit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Withdraw_providerTransactionId_key" ON "Withdraw"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdraw_lockWalletTransactionId_key" ON "Withdraw"("lockWalletTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdraw_settleWalletTransactionId_key" ON "Withdraw"("settleWalletTransactionId");

-- CreateIndex
CREATE INDEX "Withdraw_userId_status_idx" ON "Withdraw"("userId", "status");

-- CreateIndex
CREATE INDEX "Withdraw_gatewayCredentialId_idx" ON "Withdraw"("gatewayCredentialId");

-- CreateIndex
CREATE INDEX "Withdraw_status_idx" ON "Withdraw"("status");

-- CreateIndex
CREATE INDEX "Withdraw_createdAt_idx" ON "Withdraw"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhook_providerEventId_key" ON "PaymentWebhook"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_gatewayCredentialId_idx" ON "PaymentWebhook"("gatewayCredentialId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_relatedType_relatedId_idx" ON "PaymentWebhook"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "PaymentWebhook_payloadHash_idx" ON "PaymentWebhook"("payloadHash");

-- CreateIndex
CREATE INDEX "PaymentWebhook_status_idx" ON "PaymentWebhook"("status");

-- CreateIndex
CREATE INDEX "PaymentWebhook_receivedAt_idx" ON "PaymentWebhook"("receivedAt");

-- CreateIndex
CREATE INDEX "GatewayHealth_gatewayCredentialId_checkedAt_idx" ON "GatewayHealth"("gatewayCredentialId", "checkedAt");

-- CreateIndex
CREATE INDEX "GatewayLog_gatewayCredentialId_idx" ON "GatewayLog"("gatewayCredentialId");

-- CreateIndex
CREATE INDEX "GatewayLog_provider_idx" ON "GatewayLog"("provider");

-- CreateIndex
CREATE INDEX "GatewayLog_correlationId_idx" ON "GatewayLog"("correlationId");

-- CreateIndex
CREATE INDEX "GatewayLog_createdAt_idx" ON "GatewayLog"("createdAt");

-- CreateIndex
CREATE INDEX "GatewayLog_success_idx" ON "GatewayLog"("success");

-- CreateIndex (pre-existing schema drift: this index was already declared on
-- Match in the Fase 5 schema but missing from the live DB — added here since
-- it's purely additive and this migration already touches unrelated new
-- tables; no data loss risk).
CREATE INDEX "Match_userId_status_idx" ON "Match"("userId", "status");

-- AddForeignKey
ALTER TABLE "GatewayCredential" ADD CONSTRAINT "GatewayCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_gatewayCredentialId_fkey" FOREIGN KEY ("gatewayCredentialId") REFERENCES "GatewayCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdraw" ADD CONSTRAINT "Withdraw_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdraw" ADD CONSTRAINT "Withdraw_gatewayCredentialId_fkey" FOREIGN KEY ("gatewayCredentialId") REFERENCES "GatewayCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhook" ADD CONSTRAINT "PaymentWebhook_gatewayCredentialId_fkey" FOREIGN KEY ("gatewayCredentialId") REFERENCES "GatewayCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayHealth" ADD CONSTRAINT "GatewayHealth_gatewayCredentialId_fkey" FOREIGN KEY ("gatewayCredentialId") REFERENCES "GatewayCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayLog" ADD CONSTRAINT "GatewayLog_gatewayCredentialId_fkey" FOREIGN KEY ("gatewayCredentialId") REFERENCES "GatewayCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_defaultGatewayCredentialId_fkey" FOREIGN KEY ("defaultGatewayCredentialId") REFERENCES "GatewayCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
