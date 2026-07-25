import type { Withdraw, WithdrawAdminRow, WithdrawStatus } from "@/modules/payments/entities/payments.entity";

export interface CreateWithdrawInput {
  id: string;
  userId: string;
  gatewayCredentialId: string;
  amountCents: number;
  status?: WithdrawStatus;
  pixKeyEncrypted: string;
  pixKeyType?: string | null;
  providerTransactionId?: string | null;
  lockWalletTransactionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateWithdrawInput {
  status?: WithdrawStatus;
  providerTransactionId?: string | null;
  settleWalletTransactionId?: string | null;
  processedAt?: Date | null;
  rejectionReason?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WithdrawListFilter {
  userId?: string;
  status?: WithdrawStatus;
  gatewayCredentialId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface IWithdrawRepository {
  create(input: CreateWithdrawInput): Promise<Withdraw>;
  findById(id: string): Promise<Withdraw | null>;
  findByProviderTransactionId(providerTransactionId: string): Promise<Withdraw | null>;
  update(id: string, input: UpdateWithdrawInput): Promise<Withdraw>;
  listAdmin(filter: WithdrawListFilter): Promise<{ items: WithdrawAdminRow[]; total: number }>;
  /** Same join as listAdmin's rows, for a single id — the admin detail drawer's data source. */
  findByIdAdmin(id: string): Promise<WithdrawAdminRow | null>;
}
