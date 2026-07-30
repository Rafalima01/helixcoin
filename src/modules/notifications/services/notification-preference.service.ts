import { ForbiddenError } from "@/server/errors";
import { ADMIN_NOTIFICATION_CATEGORIES, MANAGER_NOTIFICATION_CATEGORIES } from "@/modules/notifications/constants/notifications.constants";
import type { INotificationPreferenceRepository } from "@/modules/notifications/interfaces/notification-preference-repository.interface";
import type { NotificationCategory } from "@/modules/notifications/entities/notifications.entity";

export interface CategoryPreference {
  category: NotificationCategory;
  enabled: boolean;
}

/**
 * Returns the full, role-scoped set of categories (defaulting enabled=true
 * when no override row exists yet) — not just whatever rows happen to be
 * in the DB. Player/Affiliate roles get an empty list back (no push
 * categories exist for them this phase — see AGENTS.md's Fase X scope
 * note), which is exactly what makes them see no preferences UI at all.
 */
export class NotificationPreferenceService {
  constructor(private readonly preferences: INotificationPreferenceRepository) {}

  async listForRole(userId: string, role: string): Promise<CategoryPreference[]> {
    const relevant = this.categoriesForRole(role);
    const rows = await this.preferences.listByUserId(userId);
    const byCategory = new Map(rows.map((r) => [r.category, r.enabled]));
    return relevant.map((category) => ({ category, enabled: byCategory.get(category) ?? true }));
  }

  async update(userId: string, role: string, category: NotificationCategory, enabled: boolean): Promise<CategoryPreference> {
    if (!this.categoriesForRole(role).includes(category)) throw new ForbiddenError();
    const row = await this.preferences.upsert(userId, category, enabled);
    return { category: row.category, enabled: row.enabled };
  }

  private categoriesForRole(role: string): readonly NotificationCategory[] {
    if (role === "SUPER_ADMIN" || role === "ADMIN") return ADMIN_NOTIFICATION_CATEGORIES;
    if (role === "MANAGER") return MANAGER_NOTIFICATION_CATEGORIES;
    return [];
  }
}
