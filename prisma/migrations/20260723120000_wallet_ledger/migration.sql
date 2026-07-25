-- Wallet + Ledger (Phase 6)
-- Hand-authored (not `prisma migrate dev` auto-diff): TransactionType's value
-- set changes (4 -> 20 values, all 4 old ones survive unchanged), Transaction
-- is renamed to WalletTransaction with several new NOT NULL columns needing
-- backfill against existing dev rows, and a brand-new append-only
-- LedgerEntry table with a circular-looking FK relationship to
-- WalletTransaction that has to be created in a specific order. `migrate
-- dev` can't resolve any of this non-interactively — applied via
-- `prisma migrate deploy`, same as the two prior hand-authored migrations.

-- CreateEnum (WalletAccount)
CREATE TYPE "WalletAccount" AS ENUM ('MAIN', 'LOCKED', 'BONUS');

-- AlterTable: Wallet gains the 2 new balance buckets
ALTER TABLE "Wallet"
  ADD COLUMN "lockedBalance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bonusBalance" INTEGER NOT NULL DEFAULT 0;

-- Replace TransactionType's value set (4 -> 20, same enum-swap pattern as
-- MatchStatus in the match_engine migration — Postgres can't add+keep a
-- value set change like this via ALTER TYPE alone within one clean step).
CREATE TYPE "TransactionType_new" AS ENUM (
  'BET', 'BET_REFUND', 'PAYOUT', 'DEPOSIT', 'DEPOSIT_PENDING', 'DEPOSIT_FAILED',
  'WITHDRAW', 'WITHDRAW_PENDING', 'WITHDRAW_REJECTED', 'WITHDRAW_APPROVED',
  'BONUS', 'CASHBACK', 'COMMISSION', 'ADJUSTMENT', 'REVERSAL', 'SYSTEM',
  'MANUAL', 'TRANSFER', 'LOCK', 'UNLOCK', 'EXPIRATION'
);

ALTER TABLE "Transaction" ADD COLUMN "type_new" "TransactionType_new";

-- Identity mapping: all 4 legacy values keep the same name in the new enum.
UPDATE "Transaction" SET "type_new" = "type"::text::"TransactionType_new";

ALTER TABLE "Transaction" ALTER COLUMN "type_new" SET NOT NULL;
ALTER TABLE "Transaction" DROP COLUMN "type";
ALTER TABLE "Transaction" RENAME COLUMN "type_new" TO "type";
DROP TYPE "TransactionType";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";

-- Rename Transaction -> WalletTransaction, including its default-named
-- constraints, so a future `prisma migrate diff` sees no drift. NOTE: the
-- old "Transaction_userId_type_idx" index was already dropped by Postgres
-- automatically above (DROP COLUMN "type" drops any index that references
-- it) — it's recreated fresh, under its final name, further down once the
-- new "type" column exists.
ALTER TABLE "Transaction" RENAME TO "WalletTransaction";
ALTER TABLE "WalletTransaction" RENAME CONSTRAINT "Transaction_pkey" TO "WalletTransaction_pkey";
ALTER TABLE "WalletTransaction" RENAME CONSTRAINT "Transaction_userId_fkey" TO "WalletTransaction_userId_fkey";
ALTER INDEX "Transaction_createdAt_idx" RENAME TO "WalletTransaction_createdAt_idx";

-- AlterTable: walletId — required, backfilled from Wallet.userId
ALTER TABLE "WalletTransaction" ADD COLUMN "walletId" TEXT;

UPDATE "WalletTransaction" t
SET "walletId" = w."id"
FROM "Wallet" w
WHERE w."userId" = t."userId";

-- Rows whose user never had a Wallet row (shouldn't exist in practice, but
-- be honest rather than crash the migration) get a wallet created for them.
INSERT INTO "Wallet" ("id", "userId", "balance", "lockedBalance", "bonusBalance", "updatedAt")
SELECT gen_random_uuid(), t."userId", 0, 0, 0, now()
FROM "WalletTransaction" t
WHERE t."walletId" IS NULL
GROUP BY t."userId";

UPDATE "WalletTransaction" t
SET "walletId" = w."id"
FROM "Wallet" w
WHERE w."userId" = t."userId" AND t."walletId" IS NULL;

ALTER TABLE "WalletTransaction" ALTER COLUMN "walletId" SET NOT NULL;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: remaining new columns.
-- ledgerId/balanceBefore/balanceAfter stay NULL for historical rows —
-- honest answer, these are audit/display fields nothing else reads.
ALTER TABLE "WalletTransaction"
  ADD COLUMN "ledgerId" TEXT,
  ADD COLUMN "account" "WalletAccount" NOT NULL DEFAULT 'MAIN',
  ADD COLUMN "balanceBefore" INTEGER,
  ADD COLUMN "balanceAfter" INTEGER,
  ADD COLUMN "origin" TEXT,
  ADD COLUMN "originId" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "metadata" JSONB;

-- Preserve method/pixKey (about to be dropped) inside metadata instead of
-- silently losing that data.
UPDATE "WalletTransaction"
SET "metadata" = jsonb_strip_nulls(jsonb_build_object('method', "method", 'pixKey', "pixKey"))
WHERE "method" IS NOT NULL OR "pixKey" IS NOT NULL;

-- originId carries over matchId's values before that column is dropped.
UPDATE "WalletTransaction" SET "originId" = "matchId" WHERE "matchId" IS NOT NULL;

UPDATE "WalletTransaction" SET "origin" = 'legacy' WHERE "origin" IS NULL;
ALTER TABLE "WalletTransaction" ALTER COLUMN "origin" SET NOT NULL;

ALTER TABLE "WalletTransaction" DROP COLUMN "method";
ALTER TABLE "WalletTransaction" DROP COLUMN "pixKey";
ALTER TABLE "WalletTransaction" DROP COLUMN "matchId";

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");
CREATE INDEX "WalletTransaction_originId_idx" ON "WalletTransaction"("originId");
CREATE INDEX "WalletTransaction_userId_type_idx" ON "WalletTransaction"("userId", "type");

-- CreateTable: LedgerEntry (append-only — see model doc comment in schema.prisma)
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "reference" TEXT,
    "referenceType" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX "LedgerEntry_debitAccount_idx" ON "LedgerEntry"("debitAccount");
CREATE INDEX "LedgerEntry_creditAccount_idx" ON "LedgerEntry"("creditAccount");
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry"("createdAt");

-- AddForeignKey: WalletTransaction.ledgerId -> LedgerEntry.id. Added last,
-- now that LedgerEntry exists — this is the real FK direction; LedgerEntry.
-- transactionId is deliberately a plain column, not a relation (see schema
-- doc comment for the creation-order rationale).
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
