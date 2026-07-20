import type { Role } from "@prisma/client";

/**
 * RBAC scaffold. The `Role` enum lives in prisma/schema.prisma (single
 * source of truth, since it's also a DB column type once an admin-account
 * module assigns roles). This file is the guard layer that reads a role off
 * an auth context and decides yes/no — no permission MATRIX is defined yet
 * ("sem permissões reais" per the Phase 2 brief); `hasRole` is the only
 * real check today, and it's what `requireRole` (context.ts) calls.
 *
 * When a real permission system is needed, the extension point is
 * `ROLE_PERMISSIONS` below — fill it in and swap `hasRole` call sites for
 * `hasPermission` without changing the guard's call signature.
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

/**
 * Placeholder for a fine-grained permission matrix (e.g. "wallets:adjust",
 * "withdrawals:approve"). Intentionally empty — every role currently maps
 * to no explicit permissions, so any `hasPermission` check fails closed
 * until a real module defines its permission strings here.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  SUPER_ADMIN: [],
  ADMIN: [],
  FINANCE: [],
  OPERATOR: [],
  MODERATOR: [],
  SUPPORT: [],
  COMPLIANCE: [],
  AUDIT: [],
};

export function hasPermission(userRole: Role | undefined, permission: string): boolean {
  if (!userRole) return false;
  if (userRole === "SUPER_ADMIN") return true;
  return ROLE_PERMISSIONS[userRole].includes(permission);
}
