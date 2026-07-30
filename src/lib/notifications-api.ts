/**
 * Client-side fetch wrapper for the self-service push endpoints
 * (src/app/api/push/**, src/app/api/notifications/preferences) — shared
 * between the Admin and Manager UIs (see AGENTS.md's Fase X scope note:
 * both are the only two roles with a push preferences screen this phase).
 * Same `request`/envelope convention as src/lib/admin/payments-api.ts.
 */

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

export interface CategoryPreferenceDto {
  category: string;
  enabled: boolean;
}

export const NotificationPreferencesApi = {
  async list() {
    return request<CategoryPreferenceDto[]>("/api/notifications/preferences");
  },
  async update(category: string, enabled: boolean) {
    return request<CategoryPreferenceDto>("/api/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({ category, enabled }),
    });
  },
};

export interface PushDeviceDto {
  id: string;
  deviceId: string;
  browser: string | null;
  os: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const PushDevicesApi = {
  async list() {
    return request<PushDeviceDto[]>("/api/push/devices");
  },
  async unsubscribe(id: string) {
    return request<{ revoked: boolean }>(`/api/push/subscribe/${id}`, { method: "DELETE" });
  },
};
