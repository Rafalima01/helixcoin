import { describe, expect, it, vi } from "vitest";
import { LoginHistoryService } from "@/modules/identity/services/login-history.service";

const findMany = vi.fn();
const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}));

describe("LoginHistoryService.listForUser", () => {
  it("queries AuditLog filtered to this actor and the auth.* action prefix", async () => {
    const row = {
      id: "log_1",
      actorId: "user_1",
      actorType: "USER",
      actorRole: null,
      action: "auth.login.success",
      entityType: "User",
      entityId: "user_1",
      before: null,
      after: null,
      ip: "127.0.0.1",
      userAgent: "vitest",
      sessionId: "sess_1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    findMany.mockResolvedValueOnce([row]);
    count.mockResolvedValueOnce(1);

    const service = new LoginHistoryService();
    const result = await service.listForUser("user_1", { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actorId: "user_1", action: { startsWith: "auth." } },
        skip: 0,
        take: 20,
      })
    );
    expect(result.total).toBe(1);
    expect(result.items[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("paginates using (page - 1) * pageSize", async () => {
    findMany.mockResolvedValueOnce([]);
    count.mockResolvedValueOnce(0);

    const service = new LoginHistoryService();
    await service.listForUser("user_1", { page: 3, pageSize: 10 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
  });
});
