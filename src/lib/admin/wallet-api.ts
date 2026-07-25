/**
 * Client-side fetch wrapper for the wallet module's admin API
 * (src/app/api/admin/wallets/**, /admin/transactions/**, src/modules/wallet).
 * Same envelope and query-building convention as src/lib/admin/matches-api.ts.
 */
import type { WalletBalancesDto, WalletTransactionDto, WalletAdminSummaryDto } from "@/modules/wallet/dto/wallet.dto";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? "Erro na requisição", json?.error?.code ?? "UNKNOWN");
  }
  return json;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface WalletListParams {
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export interface WalletDetailResponse {
  balances: WalletBalancesDto;
  recentTransactions: WalletTransactionDto[];
}

export interface AdjustWalletInput {
  /** Signed: positive credits, negative debits. */
  amount: number;
  account?: "MAIN" | "LOCKED" | "BONUS";
  reason: string;
  observation: string;
}

export const WalletsAdminApi = {
  async listWallets(params: WalletListParams) {
    return request<WalletAdminSummaryDto[]>(`/api/admin/wallets${buildQuery(params)}`);
  },

  async getWallet(userId: string) {
    return request<WalletDetailResponse>(`/api/admin/wallets/${userId}`);
  },

  async adjustWallet(userId: string, input: AdjustWalletInput) {
    return request<{ balances: WalletBalancesDto; transaction: WalletTransactionDto }>(
      `/api/admin/wallets/${userId}/adjust`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
};

export interface TransactionListParams {
  type?: string;
  status?: string;
  userId?: string;
  origin?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const TransactionsAdminApi = {
  async listTransactions(params: TransactionListParams) {
    return request<WalletTransactionDto[]>(`/api/admin/transactions${buildQuery(params)}`);
  },

  async getTransaction(id: string) {
    return request<WalletTransactionDto>(`/api/admin/transactions/${id}`);
  },
};
