import { describe, expect, it, vi, beforeEach } from "vitest";

const createUserMock = vi.fn();
const updateUserMock = vi.fn();
vi.mock("@/modules/identity/container", () => ({
  identityContainer: {
    userManagementService: {
      create: (...args: unknown[]) => createUserMock(...args),
      update: (...args: unknown[]) => updateUserMock(...args),
    },
  },
}));
vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { accountApproved: "account_approved", system: "system" },
}));

import { ManagerInviteService } from "@/modules/manager/services/manager-invite.service";
import { InMemoryManagerInviteRepository } from "@/modules/manager/repositories/manager-invite.in-memory-repository";
import { InMemoryManagerRepository } from "@/modules/manager/repositories/manager.in-memory-repository";
import { ConflictError, BusinessRuleError, NotFoundError } from "@/server/errors";

const ACTOR = { id: "admin-1", role: "ADMIN" as const };
const META = { ip: "127.0.0.1", userAgent: "vitest" };

function buildService() {
  const invites = new InMemoryManagerInviteRepository();
  const managers = new InMemoryManagerRepository();
  const service = new ManagerInviteService(invites, managers);
  return { service, invites, managers };
}

/** Candidate-supplied accept() payload — see "Cadastro de Gerente" decision: the Admin never knows this at invite creation. */
function candidate(name: string, email: string, password = "SenhaForte123!") {
  return { name, email, password };
}

describe("ManagerInviteService", () => {
  beforeEach(() => {
    createUserMock.mockReset().mockResolvedValue({ id: "new-manager-user", email: "novo@gerente.com" });
    updateUserMock.mockReset().mockResolvedValue({ id: "new-manager-user", role: "MANAGER" });
  });

  it("create() returns a raw token that is never stored — only its hash is persisted", async () => {
    const { service, invites } = buildService();
    const { invite, rawToken } = await service.create({}, ACTOR, META);
    expect(rawToken).toHaveLength(64); // randomBytes(32).toString("hex")
    const stored = await invites.findById(invite.id);
    expect(stored!.tokenHash).not.toBe(rawToken);
  });

  it("create() carries no candidate identity — name/email are null until accepted", async () => {
    const { service } = buildService();
    const { invite } = await service.create({}, ACTOR, META);
    expect(invite.name).toBeNull();
    expect(invite.email).toBeNull();
  });

  it("getPublicByToken() resolves a valid raw token as redeemable", async () => {
    const { service } = buildService();
    const { rawToken } = await service.create({}, ACTOR, META);
    const invite = await service.getPublicByToken(rawToken);
    expect(invite.status).toBe("ACTIVE");
  });

  it("getPublicByToken() throws NotFoundError for a bogus token", async () => {
    const { service } = buildService();
    await expect(service.getPublicByToken("bogus-token")).rejects.toThrow(NotFoundError);
  });

  it("accept() creates the User as a plain USER (never MANAGER) from the candidate's own submission and moves the invite to PENDING_REVIEW", async () => {
    const { service } = buildService();
    const { rawToken } = await service.create({}, ACTOR, META);

    const updated = await service.accept(rawToken, candidate("Ana Gerente", "ana@gerente.com"), META);

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@gerente.com", role: "USER", status: "ACTIVE" }),
      expect.anything(),
      META
    );
    expect(updated.status).toBe("USED");
    expect(updated.approvalStatus).toBe("PENDING_REVIEW");
    expect(updated.acceptedByUserId).toBe("new-manager-user");
    expect(updated.name).toBe("Ana Gerente");
    expect(updated.email).toBe("ana@gerente.com");
  });

  it("accept() rejects a token that was already used", async () => {
    const { service } = buildService();
    const { rawToken } = await service.create({}, ACTOR, META);
    await service.accept(rawToken, candidate("Carla", "carla@gerente.com"), META);
    await expect(service.accept(rawToken, candidate("Carla", "carla@gerente.com"), META)).rejects.toThrow(BusinessRuleError);
  });

  it("accept() rejects a revoked invite", async () => {
    const { service } = buildService();
    const { invite, rawToken } = await service.create({}, ACTOR, META);
    await service.revoke(invite.id, ACTOR, META);
    await expect(service.accept(rawToken, candidate("Dan", "dan@gerente.com"), META)).rejects.toThrow(BusinessRuleError);
  });

  it("accept() rejects an expired invite", async () => {
    const { service } = buildService();
    const { rawToken } = await service.create({ expiresInDays: 1 }, ACTOR, META);

    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000); // 2 days later
      await expect(service.getPublicByToken(rawToken)).rejects.toThrow(BusinessRuleError);
      await expect(service.accept(rawToken, candidate("Eva", "eva@gerente.com"), META)).rejects.toThrow(BusinessRuleError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accept() retries username generation on a collision without failing the whole operation", async () => {
    const { service } = buildService();
    createUserMock
      .mockRejectedValueOnce(new ConflictError("Este username já está em uso"))
      .mockResolvedValueOnce({ id: "new-manager-user-2", email: "fe@gerente.com" });

    const { rawToken } = await service.create({}, ACTOR, META);
    const updated = await service.accept(rawToken, candidate("Fê Colisão", "fe@gerente.com"), META);
    expect(updated.acceptedByUserId).toBe("new-manager-user-2");
    expect(createUserMock).toHaveBeenCalledTimes(2);
  });

  it("regenerate() invalidates the old token and issues a new one", async () => {
    const { service } = buildService();
    const { invite, rawToken: oldToken } = await service.create({}, ACTOR, META);
    const { rawToken: newToken } = await service.regenerate(invite.id, ACTOR, META);

    await expect(service.getPublicByToken(oldToken)).rejects.toThrow(NotFoundError);
    const resolved = await service.getPublicByToken(newToken);
    expect(resolved.id).toBe(invite.id);
  });

  it("regenerate() refuses to rotate an already-used invite", async () => {
    const { service } = buildService();
    const { invite, rawToken } = await service.create({}, ACTOR, META);
    await service.accept(rawToken, candidate("Helo", "helo@gerente.com"), META);
    await expect(service.regenerate(invite.id, ACTOR, META)).rejects.toThrow(BusinessRuleError);
  });

  it("revoke() marks the invite REVOKED and blocks further acceptance", async () => {
    const { service } = buildService();
    const { invite, rawToken } = await service.create({}, ACTOR, META);
    const revoked = await service.revoke(invite.id, ACTOR, META);
    expect(revoked.status).toBe("REVOKED");
    await expect(service.accept(rawToken, candidate("Ivo", "ivo@gerente.com"), META)).rejects.toThrow(BusinessRuleError);
  });

  describe("approve()/reject()", () => {
    it("approve() promotes the account to MANAGER and creates a ManagerProfile with the decided ceiling", async () => {
      const { service, managers } = buildService();
      const { invite, rawToken } = await service.create({}, ACTOR, META);
      await service.accept(rawToken, candidate("Julia", "julia@gerente.com"), META);

      const profile = await service.approve(invite.id, 70, ACTOR, META);

      expect(profile.commissionPercent).toBe(70);
      expect(profile.status).toBe("ACTIVE");
      expect(updateUserMock).toHaveBeenCalledWith(
        "new-manager-user",
        { role: "MANAGER" },
        expect.objectContaining({ id: ACTOR.id }),
        META
      );
      const stored = await managers.findByUserId("new-manager-user");
      expect(stored).not.toBeNull();

      const inviteAfter = await service.getByIdAdmin(invite.id);
      expect(inviteAfter.approvalStatus).toBe("APPROVED");
      expect(inviteAfter.approvedCommissionPercent).toBe(70);
    });

    it("approve() refuses an invite that isn't pending review", async () => {
      const { service } = buildService();
      const { invite } = await service.create({}, ACTOR, META);
      // Never accepted — no approvalStatus yet.
      await expect(service.approve(invite.id, 50, ACTOR, META)).rejects.toThrow(BusinessRuleError);
    });

    it("reject() marks the invite REJECTED and never promotes the account", async () => {
      const { service } = buildService();
      const { invite, rawToken } = await service.create({}, ACTOR, META);
      await service.accept(rawToken, candidate("Lia", "lia@gerente.com"), META);

      const rejected = await service.reject(invite.id, "Documentação insuficiente", ACTOR, META);

      expect(rejected.approvalStatus).toBe("REJECTED");
      expect(rejected.rejectionReason).toBe("Documentação insuficiente");
      expect(updateUserMock).not.toHaveBeenCalled();
    });

    it("listPendingApprovals() only returns accepted invites still awaiting a verdict", async () => {
      const { service } = buildService();
      const { invite: pendingInvite, rawToken: pendingToken } = await service.create({}, ACTOR, META);
      await service.accept(pendingToken, candidate("Mara", "mara@gerente.com"), META);

      // Never accepted — shouldn't show up.
      await service.create({}, ACTOR, META);

      const { items, total } = await service.listPendingApprovals({ page: 1, pageSize: 10 });
      expect(total).toBe(1);
      expect(items[0].id).toBe(pendingInvite.id);
    });
  });
});
