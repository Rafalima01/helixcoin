-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "CommercialWithdrawPayeeRole" AS ENUM ('AFFILIATE', 'MANAGER');

-- CreateEnum
CREATE TYPE "CommercialWithdrawStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PixKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PixKeyType" NOT NULL,
    "keyEncrypted" TEXT NOT NULL,
    "holderCpf" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialWithdraw" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payeeRole" "CommercialWithdrawPayeeRole" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CommercialWithdrawStatus" NOT NULL DEFAULT 'PENDING',
    "pixKeyId" TEXT,
    "pixKeyType" "PixKeyType" NOT NULL,
    "pixKeyEncrypted" TEXT NOT NULL,
    "holderCpf" TEXT NOT NULL,
    "lockWalletTransactionId" TEXT,
    "settleWalletTransactionId" TEXT,
    "rejectionReason" TEXT,
    "decidedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialWithdraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PixKey_userId_idx" ON "PixKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialWithdraw_lockWalletTransactionId_key" ON "CommercialWithdraw"("lockWalletTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialWithdraw_settleWalletTransactionId_key" ON "CommercialWithdraw"("settleWalletTransactionId");

-- CreateIndex
CREATE INDEX "CommercialWithdraw_userId_status_idx" ON "CommercialWithdraw"("userId", "status");

-- CreateIndex
CREATE INDEX "CommercialWithdraw_payeeRole_status_idx" ON "CommercialWithdraw"("payeeRole", "status");

-- CreateIndex
CREATE INDEX "CommercialWithdraw_status_idx" ON "CommercialWithdraw"("status");

-- CreateIndex
CREATE INDEX "CommercialWithdraw_createdAt_idx" ON "CommercialWithdraw"("createdAt");

-- AddForeignKey
ALTER TABLE "PixKey" ADD CONSTRAINT "PixKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialWithdraw" ADD CONSTRAINT "CommercialWithdraw_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialWithdraw" ADD CONSTRAINT "CommercialWithdraw_pixKeyId_fkey" FOREIGN KEY ("pixKeyId") REFERENCES "PixKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialWithdraw" ADD CONSTRAINT "CommercialWithdraw_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

