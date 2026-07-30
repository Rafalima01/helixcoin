-- Fase Demo — Modo Demo (sem cadastro) + bônus de primeiro depósito
-- admin-configurável. Aditiva: 1 tabela nova + 2 colunas novas em User.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "signupSource" TEXT;
ALTER TABLE "User" ADD COLUMN "eligibleForFirstDepositBonus" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PromotionSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "firstDepositBonusPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionSettings_pkey" PRIMARY KEY ("id")
);
