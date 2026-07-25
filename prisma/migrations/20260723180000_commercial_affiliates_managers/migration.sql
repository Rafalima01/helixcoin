-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED', 'DOCUMENTS_REQUESTED');

-- CreateEnum
CREATE TYPE "AffiliateLinkStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "CommissionSourceType" AS ENUM ('REVSHARE_DEPOSIT', 'CPA_FTD');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "affiliateLinkId" TEXT;

-- CreateTable
CREATE TABLE "ManagerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "documentsJson" JSONB,
    "pixKeyEncrypted" TEXT,
    "cpaOverrideCents" INTEGER,
    "revShareOverridePercent" DOUBLE PRECISION,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLink" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "AffiliateLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "managerId" TEXT,
    "level" INTEGER NOT NULL,
    "originUserId" TEXT NOT NULL,
    "sourceType" "CommissionSourceType" NOT NULL,
    "triggerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "percentApplied" DOUBLE PRECISION,
    "status" "CommissionStatus" NOT NULL DEFAULT 'LOCKED',
    "walletTransactionId" TEXT,
    "unlockWalletTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "revShareLevel1Percent" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "revShareLevel2Percent" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "revShareLevel3Percent" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "cpaAmountCents" INTEGER NOT NULL DEFAULT 0,
    "autoApproveCommissions" BOOLEAN NOT NULL DEFAULT true,
    "requireManagerApprovalForAffiliates" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerProfile_userId_key" ON "ManagerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerProfile_inviteCode_key" ON "ManagerProfile"("inviteCode");

-- CreateIndex
CREATE INDEX "ManagerProfile_inviteCode_idx" ON "ManagerProfile"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");

-- CreateIndex
CREATE INDEX "AffiliateProfile_managerId_idx" ON "AffiliateProfile"("managerId");

-- CreateIndex
CREATE INDEX "AffiliateProfile_status_idx" ON "AffiliateProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_slug_key" ON "AffiliateLink"("slug");

-- CreateIndex
CREATE INDEX "AffiliateLink_affiliateId_idx" ON "AffiliateLink"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_walletTransactionId_key" ON "Commission"("walletTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_unlockWalletTransactionId_key" ON "Commission"("unlockWalletTransactionId");

-- CreateIndex
CREATE INDEX "Commission_affiliateId_status_idx" ON "Commission"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "Commission_originUserId_idx" ON "Commission"("originUserId");

-- CreateIndex
CREATE INDEX "Commission_triggerId_idx" ON "Commission"("triggerId");

-- CreateIndex
CREATE INDEX "User_affiliateLinkId_idx" ON "User"("affiliateLinkId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "ManagerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_originUserId_fkey" FOREIGN KEY ("originUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
