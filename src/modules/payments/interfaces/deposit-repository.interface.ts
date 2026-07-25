import type { Deposit, DepositAdminRow, DepositStatus } from "@/modules/payments/entities/payments.entity";

export interface CreateDepositInput {
  id: string;
  userId: string;
  gatewayCredentialId: string;
  amountCents: number;
  status?: DepositStatus;
  providerTransactionId?: string | null;
  pixCode?: string | null;
  qrCodeUrl?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateDepositInput {
  status?: DepositStatus;
  walletTransactionId?: string | null;
  confirmedAt?: Date | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DepositListFilter {
  userId?: string;
  status?: DepositStatus;
  gatewayCredentialId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface IDepositRepository {
  create(input: CreateDepositInput): Promise<Deposit>;
  findById(id: string): Promise<Deposit | null>;
  findByProviderTransactionId(providerTransactionId: string): Promise<Deposit | null>;
  update(id: string, input: UpdateDepositInput): Promise<Deposit>;
  listAdmin(filter: DepositListFilter): Promise<{ items: DepositAdminRow[]; total: number }>;
  /** Same join as listAdmin's rows, for a single id — the admin detail drawer's data source. */
  findByIdAdmin(id: string): Promise<DepositAdminRow | null>;
}
