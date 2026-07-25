-- Refinamento Fase 8: manager approval flow, dual manager links, commission spread model.
-- Hand-authored (not raw `prisma migrate diff` output) because Commission.payeeUserId is a
-- new NOT NULL column on a table that may already have rows — added nullable, backfilled from
-- the existing affiliateId -> AffiliateProfile.userId join, then locked to NOT NULL. Every other
-- change here is purely additive.

-- CreateEnum
CREATE TYPE "ManagerApprovalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "CommissionSourceType" ADD VALUE 'MANAGER_SPREAD';

-- AlterTable: ManagerInvite — approval fields (all nullable/defaulted, no backfill needed)
ALTER TABLE "ManagerInvite"
  ADD COLUMN "acceptedUserAgent" TEXT,
  ADD COLUMN "approvalStatus" "ManagerApprovalStatus",
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedCommissionPercent" DOUBLE PRECISION,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ALTER COLUMN "commissionPercent" SET DEFAULT 0;

-- AlterTable: ManagerProfile — link-click counters
ALTER TABLE "ManagerProfile"
  ADD COLUMN "inviteLinkClicks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformLinkClicks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Commission — affiliateId becomes optional, payeeUserId added nullable first
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_affiliateId_fkey";
ALTER TABLE "Commission" ALTER COLUMN "affiliateId" DROP NOT NULL;
ALTER TABLE "Commission" ADD COLUMN "payeeUserId" TEXT;

-- Backfill: every existing Commission row today is affiliate-paid — derive payeeUserId from
-- the affiliate it's already linked to.
UPDATE "Commission" c
SET "payeeUserId" = ap."userId"
FROM "AffiliateProfile" ap
WHERE c."affiliateId" = ap."id"
  AND c."payeeUserId" IS NULL;

-- Now safe to enforce NOT NULL — every row (existing, backfilled above, or newly inserted by
-- application code going forward) has a value.
ALTER TABLE "Commission" ALTER COLUMN "payeeUserId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Commission_payeeUserId_idx" ON "Commission"("payeeUserId");

-- CreateIndex
CREATE INDEX "ManagerInvite_approvalStatus_idx" ON "ManagerInvite"("approvalStatus");

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payeeUserId_fkey" FOREIGN KEY ("payeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
