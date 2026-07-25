-- CreateEnum
CREATE TYPE "ManagerInviteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'USED');

-- CreateEnum
CREATE TYPE "ManagerProfileStatus" AS ENUM ('ACTIVE', 'PENDING');

-- AlterTable
ALTER TABLE "ManagerProfile" ADD COLUMN     "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "inviteId" TEXT,
ADD COLUMN     "status" "ManagerProfileStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ManagerInvite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "commissionPercent" DOUBLE PRECISION NOT NULL,
    "initialStatus" "ManagerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenHash" TEXT NOT NULL,
    "status" "ManagerInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "acceptedIp" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerInvite_tokenHash_key" ON "ManagerInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerInvite_acceptedByUserId_key" ON "ManagerInvite"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "ManagerInvite_status_idx" ON "ManagerInvite"("status");

-- CreateIndex
CREATE INDEX "ManagerInvite_email_idx" ON "ManagerInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerProfile_inviteId_key" ON "ManagerProfile"("inviteId");

-- CreateIndex
CREATE INDEX "ManagerProfile_status_idx" ON "ManagerProfile"("status");

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ManagerInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

