import type { TransactionType, TransactionStatus, WalletAccount, AuditActorType, Role } from "@prisma/client";

export type { TransactionType, TransactionStatus, WalletAccount };

/** Domain entity — the 3-bucket view WalletService exposes; `balance`/`lockedBalance`/`bonusBalance` on the Wallet row map to main/locked/bonus. */
export interface WalletBalances {
  userId: string;
  walletId: string;
  main: number;
  locked: number;
  bonus: number;
  updatedAt: Date;
}

/** Domain entity — one row per wallet-side money movement, see this module's README for the idempotency/double-entry convention. */
export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  ledgerId: string | null;
  type: TransactionType;
  account: WalletAccount;
  amount: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  origin: string;
  originId: string | null;
  description: string | null;
  status: TransactionStatus;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** Who/what initiated a wallet mutation — feeds both WalletTransaction bookkeeping and AuditService.record() for admin actions. */
export interface WalletActor {
  actorId: string | null;
  actorType: AuditActorType;
  actorRole?: Role | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface WalletMutationResult {
  transaction: WalletTransaction;
  balanceBefore: WalletBalances;
  balanceAfter: WalletBalances;
  /** True when this call returned a pre-existing transaction found by idempotencyKey instead of moving money again. */
  idempotent: boolean;
}

/** Admin list row — Wallet joined with the owning user's display fields. */
export interface WalletAdminSummary {
  userId: string;
  userName: string;
  userEmail: string;
  main: number;
  locked: number;
  bonus: number;
  updatedAt: Date;
}
