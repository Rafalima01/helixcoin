/**
 * Client-side fetch wrapper for the identity module's admin API
 * (src/app/api/admin/**, src/modules/identity). Every response follows the
 * `{ data, meta? }` / `{ error: { code, message } }` envelope from
 * src/server/http/response.ts — this is the one place that unwraps it.
 */
import type { UserResponseDto } from "@/modules/identity/dto/user.dto";
import type { SessionResponseDto } from "@/modules/identity/dto/session.dto";
import type { AuditLogResponseDto } from "@/modules/identity/dto/audit.dto";
import type { PermissionDto, RolePermissionsDto } from "@/modules/identity/dto/permission.dto";

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

export interface UserSearchParams {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  [key: string]: string | number | boolean | undefined;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== "all") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const IdentityAdminApi = {
  async searchUsers(params: UserSearchParams) {
    return request<UserResponseDto[]>(`/api/admin/users${buildQuery(params)}`);
  },

  async getUser(id: string) {
    return request<UserResponseDto>(`/api/admin/users/${id}`);
  },

  async createUser(input: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    role?: string;
    status?: string;
  }) {
    return request<UserResponseDto>("/api/admin/users", { method: "POST", body: JSON.stringify(input) });
  },

  async updateUser(id: string, input: Record<string, unknown>) {
    return request<UserResponseDto>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async blockUser(id: string, reason?: string) {
    return request<Record<string, never>>(`/api/admin/users/${id}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async unblockUser(id: string) {
    return request<Record<string, never>>(`/api/admin/users/${id}/unblock`, { method: "POST" });
  },

  async restoreUser(id: string) {
    return request<Record<string, never>>(`/api/admin/users/${id}/restore`, { method: "POST" });
  },

  async softDeleteUser(id: string) {
    return request<Record<string, never>>(`/api/admin/users/${id}`, { method: "DELETE" });
  },

  /**
   * Flips an existing player between demo and real. Refused server-side when
   * the account already has real financial history — see
   * DemoAccountService.setDemoFlag for why converting after the fact would
   * rewrite past reports.
   */
  async setUserDemoFlag(id: string, isDemo: boolean) {
    return request<Record<string, never>>(`/api/admin/users/${id}/demo-flag`, {
      method: "POST",
      body: JSON.stringify({ isDemo }),
    });
  },

  async listUserSessions(id: string) {
    return request<SessionResponseDto[]>(`/api/admin/users/${id}/sessions`);
  },

  async revokeUserSession(id: string, sessionId: string) {
    return request<Record<string, never>>(`/api/admin/users/${id}/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },

  async listUserLoginHistory(id: string, page = 1) {
    return request<AuditLogResponseDto[]>(
      `/api/admin/users/${id}/login-history${buildQuery({ page, pageSize: 20 })}`
    );
  },

  async listPermissionCatalog() {
    return request<PermissionDto[]>("/api/admin/permissions");
  },

  async listRoleGrants() {
    return request<RolePermissionsDto[]>("/api/admin/permissions/roles");
  },

  async searchAudit(params: { actorId?: string; entityType?: string; action?: string; page?: number; pageSize?: number }) {
    return request<AuditLogResponseDto[]>(`/api/admin/audit${buildQuery(params)}`);
  },
};
