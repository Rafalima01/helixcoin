-- Match Engine (Phase 5)
-- Hand-authored (not `prisma migrate dev` auto-diff): MatchStatus's value set
-- changes (removes ACTIVE, adds 6 new values) and several new NOT NULL
-- Match columns need backfill against 30 existing dev-only rows, which
-- `migrate dev` can't resolve non-interactively. Applied via `prisma migrate
-- deploy`, which doesn't require interactivity.

-- CreateEnum (MatchEventType)
CREATE TYPE "MatchEventType" AS ENUM ('CREATED', 'STARTED', 'PROGRESSED', 'GOAL_REACHED', 'CASHOUT_REQUESTED', 'CASHOUT_APPROVED', 'CASHOUT_DENIED', 'COMPLETED', 'LOST', 'CANCELLED', 'INVALIDATED');

-- Replace MatchStatus's value set (ALTER TYPE ... ADD VALUE can't be combined
-- with other DDL in one transaction the way this migration needs, and we're
-- also removing a value, which Postgres doesn't support directly — swap the
-- type instead).
CREATE TYPE "MatchStatus_new" AS ENUM ('CREATED', 'AWAITING_START', 'IN_PROGRESS', 'GOAL_REACHED', 'CASHOUT_AVAILABLE', 'CASHED_OUT', 'LOST', 'CANCELLED', 'INVALIDATED');

ALTER TABLE "Match" ADD COLUMN "status_new" "MatchStatus_new";

UPDATE "Match" SET "status_new" = (CASE "status"::text
  WHEN 'ACTIVE' THEN 'IN_PROGRESS'
  WHEN 'CASHED_OUT' THEN 'CASHED_OUT'
  WHEN 'LOST' THEN 'LOST'
  ELSE 'LOST'
END)::"MatchStatus_new";

ALTER TABLE "Match" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "status_new" SET DEFAULT 'CREATED';
ALTER TABLE "Match" DROP COLUMN "status";
ALTER TABLE "Match" RENAME COLUMN "status_new" TO "status";
DROP TYPE "MatchStatus";
ALTER TYPE "MatchStatus_new" RENAME TO "MatchStatus";

-- AlterTable: new columns with sane defaults or nullable, no backfill needed
ALTER TABLE "Match"
  ADD COLUMN "potentialPayout" INTEGER,
  ADD COLUMN "balanceAfter" INTEGER,
  ADD COLUMN "presetKey" TEXT,
  ADD COLUMN "goalSnapshot" JSONB,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "collisionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "avgSpeed" DOUBLE PRECISION,
  ADD COLUMN "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "invalidationReason" TEXT,
  ADD COLUMN "engineVersion" TEXT,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "device" TEXT,
  ADD COLUMN "os" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: required columns — add nullable, backfill, then enforce
ALTER TABLE "Match"
  ADD COLUMN "matchNumber" TEXT,
  ADD COLUMN "goalAmount" INTEGER,
  ADD COLUMN "balanceBefore" INTEGER,
  ADD COLUMN "tokenHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill: these 30 rows are all pre-launch dev/test matches (no real
-- money, no real players) — placeholders are honest ("we don't know the
-- historical balance") rather than fabricated precision.
UPDATE "Match" SET
  "matchNumber" = 'HJ-' || upper(substring(md5(id || ':number'), 1, 8)),
  "goalAmount" = round("betAmount" * "targetMultiplier")::int,
  "balanceBefore" = 0,
  "tokenHash" = md5(id || ':legacy-token:' || "createdAt"::text),
  "updatedAt" = COALESCE("resolvedAt", "createdAt");

ALTER TABLE "Match"
  ALTER COLUMN "matchNumber" SET NOT NULL,
  ALTER COLUMN "goalAmount" SET NOT NULL,
  ALTER COLUMN "balanceBefore" SET NOT NULL,
  ALTER COLUMN "tokenHash" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Match_matchNumber_key" ON "Match"("matchNumber");
CREATE UNIQUE INDEX "Match_tokenHash_key" ON "Match"("tokenHash");
CREATE INDEX "Match_matchNumber_idx" ON "Match"("matchNumber");

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchEvent_matchId_createdAt_idx" ON "MatchEvent"("matchId", "createdAt");

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
