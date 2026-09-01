import type { Withdraw, WithdrawAdminRow, WithdrawStatus } from "@/modules/payments/entities/payments.entity";

export interface CreateWithdrawInput {
  id: string;
  userId: string;
  /** Must be null when `isSimulated` is true, and set otherwise — the DB enforces it (`Withdraw_simulated_gateway_check`). */
  gatewayCredentialId: string | null;
  isSimulated?: boolean;
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
  /** Backoffice "Reais / Simulações" filter. Undefined = both. */
  isSimulated?: boolean;
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
  /**
   * Compare-and-swap used by the simulated-withdraw decision (same pattern as
   * CommercialWithdrawRepository.decide): moves the row out of `fromStatus`
   * atomically and returns null when it had already been decided, so two
   * concurrent admin clicks can never both go on to move the balance.
   * Restricted to simulated rows — a real withdraw is settled by the webhook
   * dispatcher, never by this method.
   */
  decideSimulated(
    id: string,
    fromStatus: WithdrawStatus,
    toStatus: WithdrawStatus,
    patch: { processedAt: Date; rejectionReason?: string | null }
  ): Promise<Withdraw | null>;
  listAdmin(filter: WithdrawListFilter): Promise<{ items: WithdrawAdminRow[]; total: number }>;
  /** Same join as listAdmin's rows, for a single id — the admin detail drawer's data source. */
  findByIdAdmin(id: string): Promise<WithdrawAdminRow | null>;
  /** PENDING/PROCESSING withdraws last updated before `olderThan` — PaymentReconciliationService's poll target, since a missed webhook otherwise leaves them stuck forever. */
  findStuckPending(olderThan: Date): Promise<Withdraw[]>;
}
