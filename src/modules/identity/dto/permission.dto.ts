import type { Role } from "@prisma/client";

export interface PermissionDto {
  key: string;
  description: string;
}

export interface RolePermissionsDto {
  role: Role;
  permissions: string[];
}
