import type { Role } from "@prisma/client";
import type { IPermissionRepository } from "@/modules/identity/interfaces/permission-repository.interface";

export class InMemoryPermissionRepository implements IPermissionRepository {
  private readonly catalog: { key: string; description: string }[] = [];
  private readonly grants: { role: Role; key: string }[] = [];

  seedCatalog(entries: { key: string; description: string }[]): void {
    this.catalog.push(...entries);
  }

  seedGrant(role: Role, key: string): void {
    this.grants.push({ role, key });
  }

  async listCatalog(): Promise<{ key: string; description: string }[]> {
    return [...this.catalog];
  }

  async listForRole(role: Role): Promise<string[]> {
    return this.grants.filter((g) => g.role === role).map((g) => g.key);
  }

  async listAllGrants(): Promise<{ role: Role; key: string }[]> {
    return [...this.grants];
  }
}
