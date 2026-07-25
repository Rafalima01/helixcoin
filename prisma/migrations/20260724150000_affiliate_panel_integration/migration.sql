-- Painel do Afiliado integrado ao frontend: two purely additive columns on
-- AffiliateProfile, both defaulted, no backfill needed.

-- AlterTable
ALTER TABLE "AffiliateProfile"
  ADD COLUMN "linkClicks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "canInviteAffiliates" BOOLEAN NOT NULL DEFAULT false;
