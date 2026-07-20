import type { Role } from "@prisma/client";
import type { IPermissionRepository } from "@/modules/identity/interfaces/permission-repository.interface";
import type { PermissionDto, RolePermissionsDto } from "@/modules/identity/dto/permission.dto";
import { CacheService } from "@/server/cache/cache.service";

const CACHE_TTL_SECONDS = 300;
const roleGrantsKey = (role: Role) => `identity:permissions:role:${role}`;

/**
 * DB-backed and role-independent by design (Permission/RolePermission tables
 * — see schema.prisma): roles are just named groups of permission grants,
 * not the source of truth for what a permission key means. Cached per-role
 * for 5 minutes since grants change rarely but `hasPermission` is checked
 * on most authenticated admin requests.
 */
export class PermissionService {
  constructor(private readonly permissions: IPermissionRepository) {}

  async listCatalog(): Promise<PermissionDto[]> {
    return this.permissions.listCatalog();
  }

  async listForRole(role: Role): Promise<string[]> {
    return CacheService.remember(roleGrantsKey(role), CACHE_TTL_SECONDS, () =>
      this.permissions.listForRole(role)
    );
  }

  async listAllGrants(): Promise<RolePermissionsDto[]> {
    const grants = await this.permissions.listAllGrants();
    const byRole = new Map<Role, string[]>();
    for (const { role, key } of grants) {
      const keys = byRole.get(role) ?? [];
      keys.push(key);
      byRole.set(role, keys);
    }
    return [...byRole.entries()].map(([role, permissions]) => ({ role, permissions }));
  }

  async hasPermission(role: Role, key: string): Promise<boolean> {
    const granted = await this.listForRole(role);
    return granted.includes(key);
  }

  /** Call after any RolePermission mutation — grants are cached and won't self-expire fast enough for immediate admin feedback. */
  async invalidateCache(role: Role): Promise<void> {
    await CacheService.del(roleGrantsKey(role));
  }
}
