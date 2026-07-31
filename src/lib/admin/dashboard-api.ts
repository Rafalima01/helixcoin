/**
 * Client-side fetch wrapper for the admin Dashboard's real data
 * (src/app/api/admin/dashboard/**, src/server/reports). Same
 * `{ data }` / `{ error }` envelope as src/lib/admin/identity-api.ts.
 */
import type { DashboardSummary } from "@/server/reports/dashboard-summary.service";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T }> {
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

export const DashboardAdminApi = {
  async getSummary(days = 7) {
    return request<DashboardSummary>(`/api/admin/dashboard/summary?days=${days}`);
  },
};
