/**
 * Client-side fetch wrapper for the ledger module's admin API
 * (src/app/api/admin/ledger/**, src/modules/ledger). Read-only — there is
 * no write method here by design, matching LedgerService itself.
 */
import type { LedgerEntryDto } from "@/modules/ledger/dto/ledger.dto";

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

export interface LedgerListParams {
  debitAccount?: string;
  creditAccount?: string;
  reference?: string;
  referenceType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const LedgerAdminApi = {
  async listEntries(params: LedgerListParams) {
    return request<LedgerEntryDto[]>(`/api/admin/ledger${buildQuery(params)}`);
  },

  async getEntry(id: string) {
    return request<LedgerEntryDto>(`/api/admin/ledger/${id}`);
  },
};
