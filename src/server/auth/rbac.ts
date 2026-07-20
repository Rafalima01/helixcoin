import type { Role } from "@prisma/client";

/**
 * RBAC scaffold. The `Role` enum lives in prisma/schema.prisma (single
 * source of truth, since it's also a DB column type). This file is the
 * guard layer that reads a role off an auth context and decides yes/no for
 * coarse route protection — `hasRole` is what `requireRole` (context.ts)
 * calls.
 *
 * Fine-grained, role-independent permission checks ("As permissões deverão
 * ser independentes dos cargos") live in the identity module's
 * `PermissionService.hasPermission` instead of here — it's DB-backed
 * (Permission/RolePermission tables) rather than a static map, so grants can
 * change without a deploy. Use `hasRole` for cheap, sync, JWT-claim-based
 * route gating; use `PermissionService` when a specific permission key
 * matters.
 */

export const ROLE_HIERARCHY: readonly Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "COMPLIANCE",
  "OPERATOR",
  "MODERATOR",
  "SUPPORT",
  "AUDIT",
];

export function hasRole(userRole: Role | undefined, allowed: readonly Role[]): boolean {
  if (!userRole) return false;
  if (userRole === "SUPER_ADMIN") return true; // always wins, by design
  return allowed.includes(userRole);
}
