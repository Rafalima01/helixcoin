/** Client-side fetch wrapper for src/modules/demo-accounts' admin API. Same envelope convention as src/lib/admin/promotions-api.ts. */
import type { DemoAccountListItemDto, DemoAccountCreatedDto } from "@/modules/demo-accounts/dto/demo-account.dto";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T }> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? "Erro na requisição", json?.error?.code ?? "UNKNOWN");
  }
  return json;
}

export const DemoAccountsAdminApi = {
  async list() {
    return request<DemoAccountListItemDto[]>("/api/admin/demo-accounts");
  },
  async create(initialBalanceCents: number, name?: string) {
    return request<DemoAccountCreatedDto>("/api/admin/demo-accounts", {
      method: "POST",
      body: JSON.stringify(name ? { initialBalanceCents, name } : { initialBalanceCents }),
    });
  },
  /** Altera apenas o nome de identificação — nunca telefone, senha ou saldo. */
  async rename(id: string, name: string) {
    return request<Record<string, never>>(`/api/admin/demo-accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  },
  async addBalance(id: string, amountCents: number) {
    return request<Record<string, never>>(`/api/admin/demo-accounts/${id}/balance`, {
      method: "POST",
      body: JSON.stringify({ amountCents }),
    });
  },
  async zeroBalance(id: string) {
    return request<Record<string, never>>(`/api/admin/demo-accounts/${id}/zero`, { method: "POST" });
  },
  async deactivate(id: string) {
    return request<Record<string, never>>(`/api/admin/demo-accounts/${id}/deactivate`, { method: "POST" });
  },
};
