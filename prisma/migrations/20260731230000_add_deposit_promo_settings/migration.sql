-- AlterTable
ALTER TABLE "PromotionSettings" ADD COLUMN     "depositPromoDurationSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "depositPromoEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "depositQuickAmounts" JSONB,
ADD COLUMN     "secondDepositBonusPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.2;
