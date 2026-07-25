import type { WalletBalances, WalletTransaction, WalletAdminSummary } from "@/modules/wallet/entities/wallet.entity";

export interface WalletBalancesDto {
  userId: string;
  main: number;
  locked: number;
  bonus: number;
  updatedAt: string;
}

export function toWalletBalancesDto(entity: WalletBalances): WalletBalancesDto {
  return {
    userId: entity.userId,
    main: entity.main,
    locked: entity.locked,
    bonus: entity.bonus,
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export interface WalletTransactionDto {
  id: string;
  walletId: string;
  userId: string;
  ledgerId: string | null;
  type: string;
  account: string;
  amount: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  origin: string;
  originId: string | null;
  description: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function toWalletTransactionDto(entity: WalletTransaction): WalletTransactionDto {
  // idempotencyKey deliberately omitted — internal correlation detail, never player/admin-facing.
  return {
    id: entity.id,
    walletId: entity.walletId,
    userId: entity.userId,
    ledgerId: entity.ledgerId,
    type: entity.type,
    account: entity.account,
    amount: entity.amount,
    balanceBefore: entity.balanceBefore,
    balanceAfter: entity.balanceAfter,
    origin: entity.origin,
    originId: entity.originId,
    description: entity.description,
    status: entity.status,
    metadata: entity.metadata,
    createdAt: entity.createdAt.toISOString(),
  };
}

export interface WalletAdminSummaryDto {
  userId: string;
  userName: string;
  userEmail: string;
  main: number;
  locked: number;
  bonus: number;
  updatedAt: string;
}

export function toWalletAdminSummaryDto(entity: WalletAdminSummary): WalletAdminSummaryDto {
  return {
    userId: entity.userId,
    userName: entity.userName,
    userEmail: entity.userEmail,
    main: entity.main,
    locked: entity.locked,
    bonus: entity.bonus,
    updatedAt: entity.updatedAt.toISOString(),
  };
}
