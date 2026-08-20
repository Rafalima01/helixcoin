/**
 * Client-side fetch wrapper for src/modules/commercial-withdrawals' admin
 * API (src/app/api/admin/commercial-withdrawals/**). Same envelope/query-
 * building convention as every other src/lib/admin/*-api.ts file (see e.g.
 * payments-api.ts) — `request`/`buildQuery` are duplicated locally rather
 * than imported, matching this codebase's established per-file convention
 * (none of the sibling *-api.ts files export theirs either).
 */
import type { CommercialWithdrawAdminDto, CommercialWithdrawSummaryDto } from "@/modules/commercial-withdrawals/dto/commercial-withdraw.dto";

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

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface CommercialWithdrawListParams {
  status?: string;
  payeeRole?: string;
  userId?: string;
  /** "Vínculo" filter — DIRECT (afiliado direto) / MANAGED (afiliado de gerente). Resolved server-side from AffiliateProfile.managerId, never client-side. */
  bond?: string;
  /** ISO 8601 — the "Período" filter, applied to CommercialWithdraw.createdAt server-side. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export interface CommercialWithdrawSummaryParams {
  payeeRole?: string;
  bond?: string;
  from?: string;
  to?: string;
  [key: string]: string | number | undefined;
}

export const CommercialWithdrawalsAdminApi = {
  async list(params: CommercialWithdrawListParams) {
    return request<CommercialWithdrawAdminDto[]>(`/api/admin/commercial-withdrawals${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<CommercialWithdrawAdminDto>(`/api/admin/commercial-withdrawals/${id}`);
  },
  async decide(id: string, action: "APPROVE" | "REJECT", rejectionReason?: string) {
    return request<{ id: string; status: string }>(`/api/admin/commercial-withdrawals/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ action, rejectionReason }),
    });
  },
  /** Summary cards — pendentes/total solicitado/pago/quantidade, same filters as list minus status/pagination. */
  async getSummary(params: CommercialWithdrawSummaryParams) {
    return request<CommercialWithdrawSummaryDto>(`/api/admin/commercial-withdrawals/summary${buildQuery(params)}`);
  },
};
