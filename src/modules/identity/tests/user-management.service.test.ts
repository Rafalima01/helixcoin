import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserManagementService } from "@/modules/identity/services/user-management.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { ConflictError, NotFoundError, BusinessRuleError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { AdminActor } from "@/modules/identity/services/user-management.service";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return { ...actual, revokeFamily: vi.fn() };
});

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };
const actor: AdminActor = { id: "admin_1", role: "ADMIN" };

function buildService() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemoryUserSessionRepository();
  return { service: new UserManagementService(users, sessions), users, sessions };
}

const baseInput = {
  firstName: "Rafael",
  lastName: "Lima",
  username: "rafa",
  email: "rafa@test.com",
  password: "Sup3rSecret!",
};

describe("UserManagementService.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a user with a hashed password", async () => {
    const { service } = buildService();
    const user = await service.create(baseInput, actor, meta);
    expect(user.passwordHash).not.toBe(baseInput.password);
    expect(user.email).toBe(baseInput.email);
  });

  it("rejects a duplicate email", async () => {
    const { service } = buildService();
    await service.create(baseInput, actor, meta);
    await expect(
      service.create({ ...baseInput, username: "other" }, actor, meta)
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a duplicate username", async () => {
    const { service } = buildService();
    await service.create(baseInput, actor, meta);
    await expect(
      service.create({ ...baseInput, email: "other@test.com" }, actor, meta)
    ).rejects.toThrow(ConflictError);
  });
});

describe("UserManagementService.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies field changes", async () => {
    const { service, users } = buildService();
    const user = await service.create(baseInput, actor, meta);
    const updated = await service.update(user.id, { firstName: "Rafa" }, actor, meta);
    expect(updated.firstName).toBe("Rafa");
    expect((await users.findById(user.id))!.firstName).toBe("Rafa");
  });

  it("rejects changing to an email already used by another user", async () => {
    const { service } = buildService();
    await service.create(baseInput, actor, meta);
    const other = await service.create({ ...baseInput, username: "other", email: "other@test.com" }, actor, meta);
    await expect(service.update(other.id, { email: baseInput.email }, actor, meta)).rejects.toThrow(ConflictError);
  });

  it("throws NotFoundError for an unknown id", async () => {
    const { service } = buildService();
    await expect(service.update("does-not-exist", { firstName: "X" }, actor, meta)).rejects.toThrow(NotFoundError);
  });
});

describe("UserManagementService.block / unblock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks an active user and revokes their sessions", async () => {
    const { service, users, sessions } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await sessions.create({
      id: "fam_1",
      userId: user.id,
      familyId: "fam_1",
      ip: null,
      userAgent: null,
      os: null,
      browser: null,
      device: null,
      rememberMe: false,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await service.block(user.id, actor, meta, "fraude suspeita");

    expect((await users.findById(user.id))!.status).toBe("BLOCKED");
    expect((await sessions.findById("fam_1"))!.status).toBe("REVOKED");
  });

  it("rejects blocking an already-blocked user", async () => {
    const { service } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await service.block(user.id, actor, meta);
    await expect(service.block(user.id, actor, meta)).rejects.toThrow(BusinessRuleError);
  });

  it("unblocks a blocked user", async () => {
    const { service, users } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await service.block(user.id, actor, meta);
    await service.unblock(user.id, actor, meta);
    expect((await users.findById(user.id))!.status).toBe("ACTIVE");
  });

  it("rejects unblocking a user that isn't blocked", async () => {
    const { service } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await expect(service.unblock(user.id, actor, meta)).rejects.toThrow(BusinessRuleError);
  });
});

describe("UserManagementService.softDelete / restore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes and then restores a user", async () => {
    const { service, users } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await service.softDelete(user.id, actor, meta);
    expect((await users.findById(user.id))!.deletedAt).not.toBeNull();

    await service.restore(user.id, actor, meta);
    expect((await users.findById(user.id))!.deletedAt).toBeNull();
  });

  it("rejects double soft-delete", async () => {
    const { service } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await service.softDelete(user.id, actor, meta);
    await expect(service.softDelete(user.id, actor, meta)).rejects.toThrow(BusinessRuleError);
  });

  it("rejects restoring a user that isn't deleted", async () => {
    const { service } = buildService();
    const user = await service.create(baseInput, actor, meta);
    await expect(service.restore(user.id, actor, meta)).rejects.toThrow(BusinessRuleError);
  });
});

describe("UserManagementService.search", () => {
  it("delegates to the repository", async () => {
    const { service } = buildService();
    await service.create(baseInput, actor, meta);
    const result = await service.search({ page: 1, pageSize: 20, sort: "createdAt", order: "desc" });
    expect(result.total).toBe(1);
  });
});
