/**
 * Client-side fetch wrapper for the game-config module's admin API
 * (src/app/api/admin/game-config/**, src/modules/game-config). Same
 * `{ data, meta? }` / `{ error }` envelope as src/lib/admin/identity-api.ts.
 */
import type {
  GameEconomyConfigResponseDto,
  GameEconomyConfigVersionSummaryDto,
} from "@/modules/game-config/dto/game-economy-config.dto";
import type { UpsertDraftInput } from "@/modules/game-config/validators/game-economy-config.validator";

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

export const GameConfigAdminApi = {
  async get() {
    return request<{ active: GameEconomyConfigResponseDto | null; draft: GameEconomyConfigResponseDto | null }>(
      "/api/admin/game-config"
    );
  },

  async saveDraft(patch: UpsertDraftInput) {
    return request<GameEconomyConfigResponseDto>("/api/admin/game-config/draft", {
      method: "POST",
      body: JSON.stringify(patch),
    });
  },

  async activate(versionId?: string) {
    return request<GameEconomyConfigResponseDto>("/api/admin/game-config/activate", {
      method: "POST",
      body: JSON.stringify(versionId ? { versionId } : {}),
    });
  },

  async listVersions(page = 1, pageSize = 20) {
    return request<GameEconomyConfigVersionSummaryDto[]>(
      `/api/admin/game-config/versions?page=${page}&pageSize=${pageSize}`
    );
  },

  async restoreVersion(versionId: string) {
    return request<GameEconomyConfigResponseDto>(`/api/admin/game-config/versions/${versionId}/restore`, {
      method: "POST",
    });
  },

  async getPlatformConfig() {
    return request<{ maintenanceMode: boolean }>("/api/admin/game-config/platform");
  },

  async setMaintenanceMode(maintenanceMode: boolean) {
    return request<{ maintenanceMode: boolean }>("/api/admin/game-config/platform", {
      method: "PATCH",
      body: JSON.stringify({ maintenanceMode }),
    });
  },
};
