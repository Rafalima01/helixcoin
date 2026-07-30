/**
 * Client-side fetch wrapper for src/modules/payments' admin API
 * (src/app/api/admin/payments/**). Same envelope/query-building convention
 * as src/lib/admin/wallet-api.ts.
 */
import type {
  DepositAdminDto,
  WithdrawAdminDto,
  GatewayCredentialAdminDto,
  PaymentWebhookAdminDto,
  GatewayLogAdminDto,
  PaymentSettingsDto,
} from "@/modules/payments/dto/payments.dto";

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

export interface DepositListParams {
  status?: string;
  gatewayCredentialId?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export type AdminDepositSimulateOutcome = "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export const DepositsAdminApi = {
  async list(params: DepositListParams) {
    return request<DepositAdminDto[]>(`/api/admin/payments/deposits${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<DepositAdminDto>(`/api/admin/payments/deposits/${id}`);
  },
  /** Fase 10 admin simulator — MOCK-only, broader than the player's own PAID/FAILED demo button. */
  async simulate(id: string, outcome: AdminDepositSimulateOutcome) {
    return request<{ status: number }>(`/api/admin/payments/deposits/${id}/simulate`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    });
  },
};

export interface WithdrawListParams {
  status?: string;
  gatewayCredentialId?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const WithdrawalsAdminApi = {
  async list(params: WithdrawListParams) {
    return request<WithdrawAdminDto[]>(`/api/admin/payments/withdrawals${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<WithdrawAdminDto>(`/api/admin/payments/withdrawals/${id}`);
  },
  async decide(id: string, action: "APPROVE" | "REJECT", rejectionReason?: string) {
    return request<{ status: number }>(`/api/admin/payments/withdrawals/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ action, rejectionReason }),
    });
  },
};

export interface GatewayListParams {
  provider?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateGatewayInput {
  name: string;
  provider: string;
  mode?: "SANDBOX" | "PRODUCTION";
  credentials?: Record<string, unknown>;
  webhookSecret: string;
  active?: boolean;
  priority?: number;
  weight?: number;
  timeoutMs?: number;
  maxRetries?: number;
  simulatedHealth?: "ONLINE" | "DEGRADED" | "OFFLINE" | null;
  simulatedErrorMode?: "TIMEOUT" | "ERROR_500" | "AUTH_ERROR" | "OFFLINE_CALLS" | null;
}

export type UpdateGatewayInput = Partial<Omit<CreateGatewayInput, "provider">>;

export const GatewaysAdminApi = {
  async list(params: GatewayListParams) {
    return request<GatewayCredentialAdminDto[]>(`/api/admin/payments/gateways${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<GatewayCredentialAdminDto>(`/api/admin/payments/gateways/${id}`);
  },
  async create(input: CreateGatewayInput) {
    return request<GatewayCredentialAdminDto>("/api/admin/payments/gateways", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async update(id: string, input: UpdateGatewayInput) {
    return request<GatewayCredentialAdminDto>(`/api/admin/payments/gateways/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  async testConnection(id: string) {
    return request<{ status: string; latencyMs: number; message?: string }>(
      `/api/admin/payments/gateways/${id}/test-connection`,
      { method: "POST" }
    );
  },
};

export interface WebhookListParams {
  status?: string;
  provider?: string;
  relatedType?: string;
  relatedId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const WebhooksAdminApi = {
  async list(params: WebhookListParams) {
    return request<PaymentWebhookAdminDto[]>(`/api/admin/payments/webhooks${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<PaymentWebhookAdminDto>(`/api/admin/payments/webhooks/${id}`);
  },
  async reprocess(id: string) {
    return request<{ status: number }>(`/api/admin/payments/webhooks/${id}/reprocess`, { method: "POST" });
  },
};

export interface GatewayLogListParams {
  gatewayCredentialId?: string;
  provider?: string;
  direction?: "outbound" | "inbound";
  correlationId?: string;
  success?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | boolean | undefined;
}

export const PaymentLogsAdminApi = {
  async list(params: GatewayLogListParams) {
    return request<GatewayLogAdminDto[]>(`/api/admin/payments/logs${buildQuery(params)}`);
  },
};

export const PaymentSettingsAdminApi = {
  async get() {
    return request<PaymentSettingsDto>("/api/admin/payments/settings");
  },
  async update(input: Partial<Omit<PaymentSettingsDto, "id" | "updatedAt">>) {
    return request<PaymentSettingsDto>("/api/admin/payments/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};
