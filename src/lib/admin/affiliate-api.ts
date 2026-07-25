/**
 * Client-side fetch wrapper for src/modules/affiliate & src/modules/manager's
 * admin API (src/app/api/admin/affiliate/**, src/app/api/admin/manager/**).
 * Same envelope/query-building convention as src/lib/admin/payments-api.ts.
 */
import type {
  AffiliateProfileAdminDto,
  CommissionAdminDto,
  AffiliateSettingsDto,
} from "@/modules/affiliate/dto/affiliate.dto";
import type { ManagerProfileAdminDto } from "@/modules/manager/dto/manager.dto";
import type { ManagerInviteAdminDto, CreateManagerInviteResultDto } from "@/modules/manager/dto/manager-invite.dto";

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

export interface AffiliateApplicationListParams {
  status?: string;
  managerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export type AffiliateDecisionAction = "APPROVE" | "REJECT" | "BLOCK" | "REQUEST_DOCUMENTS";

export const AffiliateApplicationsAdminApi = {
  async list(params: AffiliateApplicationListParams) {
    return request<AffiliateProfileAdminDto[]>(`/api/admin/affiliate/applications${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<AffiliateProfileAdminDto>(`/api/admin/affiliate/applications/${id}`);
  },
  async decide(id: string, action: AffiliateDecisionAction, reason?: string) {
    return request<AffiliateProfileAdminDto>(`/api/admin/affiliate/applications/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
  },
  async assignManager(id: string, managerId: string | null) {
    return request<AffiliateProfileAdminDto>(`/api/admin/affiliate/applications/${id}/assign-manager`, {
      method: "POST",
      body: JSON.stringify({ managerId }),
    });
  },
};

export interface AffiliateCommissionListParams {
  affiliateId?: string;
  managerId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const AffiliateCommissionsAdminApi = {
  async list(params: AffiliateCommissionListParams) {
    return request<CommissionAdminDto[]>(`/api/admin/affiliate/commissions${buildQuery(params)}`);
  },
  async decide(id: string, action: "APPROVE" | "REJECT", reason?: string) {
    return request<{ id: string; status: string }>(`/api/admin/affiliate/commissions/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
  },
};

export const AffiliateSettingsAdminApi = {
  async get() {
    return request<AffiliateSettingsDto>("/api/admin/affiliate/settings");
  },
  async update(input: Partial<Omit<AffiliateSettingsDto, "id" | "updatedAt">>) {
    return request<AffiliateSettingsDto>("/api/admin/affiliate/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
};

export interface ManagerListParams {
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const ManagersAdminApi = {
  async list(params: ManagerListParams) {
    return request<ManagerProfileAdminDto[]>(`/api/admin/manager${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<ManagerProfileAdminDto>(`/api/admin/manager/${id}`);
  },
  async activate(id: string) {
    return request<ManagerProfileAdminDto>(`/api/admin/manager/${id}/activate`, { method: "PATCH" });
  },
  async updateCommission(id: string, commissionPercent: number) {
    return request<ManagerProfileAdminDto>(`/api/admin/manager/${id}/commission`, {
      method: "PATCH",
      body: JSON.stringify({ commissionPercent }),
    });
  },
};

/** The Admin only generates a bare token/link — no candidate identity here (see "Cadastro de Gerente" decision). */
export interface CreateManagerInviteInput {
  expiresInDays?: number;
}

export interface ManagerInviteListParams {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export const ManagerInvitesAdminApi = {
  async list(params: ManagerInviteListParams) {
    return request<ManagerInviteAdminDto[]>(`/api/admin/manager/invites${buildQuery(params)}`);
  },
  async get(id: string) {
    return request<ManagerInviteAdminDto>(`/api/admin/manager/invites/${id}`);
  },
  async create(input: CreateManagerInviteInput) {
    return request<CreateManagerInviteResultDto>("/api/admin/manager/invites", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async regenerate(id: string) {
    return request<CreateManagerInviteResultDto>(`/api/admin/manager/invites/${id}/regenerate`, { method: "POST" });
  },
  async revoke(id: string) {
    return request<ManagerInviteAdminDto>(`/api/admin/manager/invites/${id}/revoke`, { method: "POST" });
  },
  async listPendingApprovals(params: { page?: number; pageSize?: number; search?: string } = {}) {
    return request<ManagerInviteAdminDto[]>(`/api/admin/manager/invites/pending-review${buildQuery(params)}`);
  },
  async approve(id: string, commissionPercent: number) {
    return request<ManagerProfileAdminDto>(`/api/admin/manager/invites/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ commissionPercent }),
    });
  },
  async reject(id: string, reason: string) {
    return request<ManagerInviteAdminDto>(`/api/admin/manager/invites/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
};
