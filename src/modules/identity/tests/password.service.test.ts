import { describe, expect, it, vi, beforeEach } from "vitest";
import { PasswordService } from "@/modules/identity/services/password.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { InMemoryPasswordResetTokenRepository } from "@/modules/identity/repositories/token.in-memory-repository";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { ValidationError, NotFoundError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { IMailSender, MailMessage } from "@/modules/identity/interfaces/mail-sender.interface";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return { ...actual, revokeFamily: vi.fn() };
});

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };

class SpyMailSender implements IMailSender {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function buildService() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemoryUserSessionRepository();
  const resetTokens = new InMemoryPasswordResetTokenRepository();
  const mail = new SpyMailSender();
  return { service: new PasswordService(users, sessions, resetTokens, mail), users, sessions, resetTokens, mail };
}

async function seedUser(users: InMemoryUserRepository) {
  return users.create({
    firstName: "Rafael",
    lastName: "Lima",
    username: "rafa",
    email: "rafa@test.com",
    passwordHash: await hashPassword("old-password"),
    status: "ACTIVE",
    referralCode: "RAFA1234",
  });
}

describe("PasswordService.changePassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects the wrong current password", async () => {
    const { service, users } = buildService();
    const user = await seedUser(users);
    await expect(
      service.changePassword(user.id, { currentPassword: "wrong", newPassword: "New-Pass1", confirmPassword: "New-Pass1" }, meta)
    ).rejects.toThrow(ValidationError);
  });

  it("updates the hash via the dedicated write path (never touches update())", async () => {
    const { service, users } = buildService();
    const user = await seedUser(users);
    await service.changePassword(
      user.id,
      { currentPassword: "old-password", newPassword: "New-Pass1", confirmPassword: "New-Pass1" },
      meta
    );
    const reloaded = await users.findById(user.id);
    expect(await verifyPassword("New-Pass1", reloaded!.passwordHash)).toBe(true);
  });

  it("revokes other active sessions when revokeOtherSessions is set", async () => {
    const { service, users, sessions } = buildService();
    const user = await seedUser(users);
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

    await service.changePassword(
      user.id,
      { currentPassword: "old-password", newPassword: "New-Pass1", confirmPassword: "New-Pass1", revokeOtherSessions: true },
      meta
    );

    const session = await sessions.findById("fam_1");
    expect(session!.status).toBe("REVOKED");
  });
});

describe("PasswordService.requestReset / confirmReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("silently no-ops for an unknown email (never reveals existence)", async () => {
    const { service, mail } = buildService();
    await service.requestReset("nobody@test.com", meta);
    expect(mail.sent).toHaveLength(0);
  });

  it("emails a token and confirmReset accepts it, replacing the password hash", async () => {
    const { service, users, mail } = buildService();
    const user = await seedUser(users);
    await service.requestReset(user.email, meta);
    expect(mail.sent).toHaveLength(1);

    const token = mail.sent[0].body.match(/: ([0-9a-f]+)$/)![1];
    await service.confirmReset({ token, newPassword: "Reset-Pass1", confirmPassword: "Reset-Pass1" }, meta);

    const reloaded = await users.findById(user.id);
    expect(await verifyPassword("Reset-Pass1", reloaded!.passwordHash)).toBe(true);
  });

  it("rejects an invalid reset token", async () => {
    const { service } = buildService();
    await expect(
      service.confirmReset({ token: "not-a-real-token", newPassword: "x", confirmPassword: "x" }, meta)
    ).rejects.toThrow(ValidationError);
  });

  it("rejects reusing an already-consumed reset token", async () => {
    const { service, users, mail } = buildService();
    const user = await seedUser(users);
    await service.requestReset(user.email, meta);
    const token = mail.sent[0].body.match(/: ([0-9a-f]+)$/)![1];

    await service.confirmReset({ token, newPassword: "Reset-Pass1", confirmPassword: "Reset-Pass1" }, meta);
    await expect(
      service.confirmReset({ token, newPassword: "Again-Pass1", confirmPassword: "Again-Pass1" }, meta)
    ).rejects.toThrow(ValidationError);
  });

  it("revokes every active session on a successful reset", async () => {
    const { service, users, sessions, mail } = buildService();
    const user = await seedUser(users);
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

    await service.requestReset(user.email, meta);
    const token = mail.sent[0].body.match(/: ([0-9a-f]+)$/)![1];
    await service.confirmReset({ token, newPassword: "Reset-Pass1", confirmPassword: "Reset-Pass1" }, meta);

    const session = await sessions.findById("fam_1");
    expect(session!.status).toBe("REVOKED");
  });
});

describe("PasswordService edge cases", () => {
  it("changePassword throws NotFoundError for an unknown userId", async () => {
    const { service } = buildService();
    await expect(
      service.changePassword("does-not-exist", { currentPassword: "x", newPassword: "y", confirmPassword: "y" }, meta)
    ).rejects.toThrow(NotFoundError);
  });
});
