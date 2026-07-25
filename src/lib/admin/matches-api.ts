/**
 * Client-side fetch wrapper for the match-engine module's admin API
 * (src/app/api/admin/matches/**, src/modules/match-engine). Same envelope
 * and query-building convention as src/lib/admin/identity-api.ts.
 */
import type { MatchSummaryDto, MatchDetailDto } from "@/modules/match-engine/dto/match.dto";

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

export interface MatchListParams {
  status?: string;
  mode?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const MatchesAdminApi = {
  async listMatches(params: MatchListParams) {
    return request<MatchSummaryDto[]>(`/api/admin/matches${buildQuery(params)}`);
  },

  async getMatch(id: string) {
    return request<MatchDetailDto>(`/api/admin/matches/${id}`);
  },
};
