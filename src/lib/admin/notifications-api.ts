/** Client-side fetch wrapper for src/modules/notifications' admin history API — same request/envelope convention as src/lib/admin/payments-api.ts. */
import { ApiError } from "@/lib/notifications-api";

export { ApiError };

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
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

export interface PushNotificationLogDto {
  id: string;
  subscriptionId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  deepLink: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

export interface HistoryListParams {
  userId?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const NotificationsAdminApi = {
  async list(params: HistoryListParams) {
    return request<PushNotificationLogDto[]>(`/api/admin/notifications/history${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<PushNotificationLogDto>(`/api/admin/notifications/history/${id}`);
  },
  async sendTest() {
    return request<{ sent: boolean }>("/api/admin/notifications/test", { method: "POST" });
  },
};
