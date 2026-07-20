import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IPermissionRepository } from "@/modules/identity/interfaces/permission-repository.interface";

export class PrismaPermissionRepository implements IPermissionRepository {
  async listCatalog(): Promise<{ key: string; description: string }[]> {
    const rows = await prisma.permission.findMany({ orderBy: { key: "asc" } });
    return rows.map((r) => ({ key: r.key, description: r.description }));
  }

  async listForRole(role: Role): Promise<string[]> {
    const rows = await prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });
    return rows.map((r) => r.permission.key);
  }

  async listAllGrants(): Promise<{ role: Role; key: string }[]> {
    const rows = await prisma.rolePermission.findMany({ include: { permission: true } });
    return rows.map((r) => ({ role: r.role, key: r.permission.key }));
  }
}
