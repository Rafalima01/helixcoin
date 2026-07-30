/** Client-side fetch wrapper for src/modules/promotions' admin API (src/app/api/admin/promotions/settings). Same envelope convention as src/lib/admin/affiliate-api.ts. */
import type { PromotionSettingsDto } from "@/modules/promotions/dto/promotions.dto";

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

export const PromotionSettingsAdminApi = {
  async get() {
    return request<PromotionSettingsDto>("/api/admin/promotions/settings");
  },
  async update(input: Partial<Omit<PromotionSettingsDto, "id" | "updatedAt">>) {
    return request<PromotionSettingsDto>("/api/admin/promotions/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};
