import type { Role } from "@prisma/client";

export interface IPermissionRepository {
  listCatalog(): Promise<{ key: string; description: string }[]>;
  listForRole(role: Role): Promise<string[]>;
  listAllGrants(): Promise<{ role: Role; key: string }[]>;
}
