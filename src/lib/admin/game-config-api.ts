/**
 * Client-side fetch wrapper for the game-config module's admin API
 * (src/app/api/admin/game-config/**, src/modules/game-config). Same
 * `{ data, meta? }` / `{ error }` envelope as src/lib/admin/identity-api.ts.
 *
 * `request`/`ApiError` come from the shared api-client — it silently
 * refreshes an expired access token and retries once instead of surfacing
 * "Authentication required" on a long-lived open admin page (see that
 * module's doc comment for the full story).
 */
import type {
  GameEconomyConfigResponseDto,
  GameEconomyConfigVersionSummaryDto,
} from "@/modules/game-config/dto/game-economy-config.dto";
import type { UpsertDraftInput } from "@/modules/game-config/validators/game-economy-config.validator";
import { request, ApiError } from "@/lib/admin/api-client";

export { ApiError };
export type { PaginationMeta } from "@/lib/admin/api-client";

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
