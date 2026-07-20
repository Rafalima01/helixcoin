-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('DEMO', 'NORMAL', 'HARD');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "configVersion" INTEGER,
ADD COLUMN     "engineParams" JSONB,
ADD COLUMN     "mode" "GameMode" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "GameEconomyConfig" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "general" JSONB NOT NULL,
    "modes" JSONB NOT NULL,
    "antiCheat" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "GameEconomyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameEconomyConfig_version_key" ON "GameEconomyConfig"("version");

-- CreateIndex
CREATE INDEX "GameEconomyConfig_status_idx" ON "GameEconomyConfig"("status");

-- AddForeignKey
ALTER TABLE "GameEconomyConfig" ADD CONSTRAINT "GameEconomyConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
