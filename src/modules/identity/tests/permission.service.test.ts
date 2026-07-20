import { describe, expect, it, vi, beforeEach } from "vitest";
import { PermissionService } from "@/modules/identity/services/permission.service";
import { InMemoryPermissionRepository } from "@/modules/identity/repositories/permission.in-memory-repository";

// PermissionService caches through CacheService, which is a thin wrapper over
// a real Redis connection — not available in the unit test environment, so
// it's swapped for a plain in-memory Map with the same shape.
vi.mock("@/server/cache/cache.service", () => {
  const store = new Map<string, unknown>();
  return {
    CacheService: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      remember: vi.fn(async (key: string, _ttl: number, compute: () => Promise<unknown>) => {
        if (store.has(key)) return store.get(key);
        const value = await compute();
        store.set(key, value);
        return value;
      }),
    },
  };
});

function buildService() {
  const repo = new InMemoryPermissionRepository();
  return { service: new PermissionService(repo), repo };
}

describe("PermissionService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listCatalog returns the repository's catalog", async () => {
    const { service, repo } = buildService();
    repo.seedCatalog([{ key: "users:read", description: "Ver usuários" }]);
    await expect(service.listCatalog()).resolves.toEqual([{ key: "users:read", description: "Ver usuários" }]);
  });

  it("hasPermission is true when the role has the grant", async () => {
    const { service, repo } = buildService();
    repo.seedGrant("SUPPORT", "users:read");
    await expect(service.hasPermission("SUPPORT", "users:read")).resolves.toBe(true);
    await expect(service.hasPermission("SUPPORT", "users:delete")).resolves.toBe(false);
  });

  it("permission grants are independent of role — no role auto-grants", async () => {
    const { service, repo } = buildService();
    repo.seedGrant("ADMIN", "users:read");
    await expect(service.hasPermission("SUPER_ADMIN", "users:read")).resolves.toBe(false);
  });

  it("caches listForRole results — repository is only queried once per role", async () => {
    const { service, repo } = buildService();
    repo.seedGrant("OPERATOR", "wallets:read");
    const spy = vi.spyOn(repo, "listForRole");

    await service.listForRole("OPERATOR");
    await service.listForRole("OPERATOR");

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("invalidateCache forces a fresh repository read", async () => {
    const { service, repo } = buildService();
    repo.seedGrant("MODERATOR", "wallets:read");
    const spy = vi.spyOn(repo, "listForRole");

    await service.listForRole("MODERATOR");
    await service.invalidateCache("MODERATOR");
    await service.listForRole("MODERATOR");

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("listAllGrants groups permissions by role", async () => {
    const { service, repo } = buildService();
    repo.seedGrant("ADMIN", "users:read");
    repo.seedGrant("ADMIN", "users:write");
    repo.seedGrant("SUPPORT", "users:read");

    const grants = await service.listAllGrants();
    const admin = grants.find((g) => g.role === "ADMIN");
    expect(admin!.permissions.sort()).toEqual(["users:read", "users:write"]);
  });
});
