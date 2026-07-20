import { describe, expect, it, vi, beforeEach } from "vitest";
import { EmailVerificationService } from "@/modules/identity/services/email-verification.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryEmailVerificationTokenRepository } from "@/modules/identity/repositories/token.in-memory-repository";
import { hashPassword } from "@/server/auth/password";
import { ValidationError, NotFoundError, ConflictError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { IMailSender, MailMessage } from "@/modules/identity/interfaces/mail-sender.interface";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };

class SpyMailSender implements IMailSender {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

function buildService() {
  const users = new InMemoryUserRepository();
  const tokens = new InMemoryEmailVerificationTokenRepository();
  const mail = new SpyMailSender();
  return { service: new EmailVerificationService(users, tokens, mail), users, tokens, mail };
}

async function seedUnverifiedUser(users: InMemoryUserRepository) {
  return users.create({
    firstName: "Rafael",
    lastName: "Lima",
    username: "rafa",
    email: "rafa@test.com",
    passwordHash: await hashPassword("password"),
    status: "PENDING",
    referralCode: "RAFA1234",
  });
}

describe("EmailVerificationService.requestVerification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NotFoundError for an unknown user", async () => {
    const { service } = buildService();
    await expect(service.requestVerification("does-not-exist", meta)).rejects.toThrow(NotFoundError);
  });

  it("rejects an already-verified user", async () => {
    const { service, users } = buildService();
    const user = await seedUnverifiedUser(users);
    await users.update(user.id, { emailVerifiedAt: new Date() });
    await expect(service.requestVerification(user.id, meta)).rejects.toThrow(ConflictError);
  });

  it("emails a token", async () => {
    const { service, users, mail } = buildService();
    const user = await seedUnverifiedUser(users);
    await service.requestVerification(user.id, meta);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe(user.email);
  });
});

describe("EmailVerificationService.confirmVerification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid token", async () => {
    const { service } = buildService();
    await expect(service.confirmVerification({ token: "not-real" }, meta)).rejects.toThrow(ValidationError);
  });

  it("marks the user as verified and consumes the token", async () => {
    const { service, users, mail } = buildService();
    const user = await seedUnverifiedUser(users);
    await service.requestVerification(user.id, meta);
    const token = mail.sent[0].body.match(/: ([0-9a-f]+)$/)![1];

    await service.confirmVerification({ token }, meta);

    const reloaded = await users.findById(user.id);
    expect(reloaded!.emailVerifiedAt).not.toBeNull();

    await expect(service.confirmVerification({ token }, meta)).rejects.toThrow(ValidationError);
  });

  it("rejects a token issued for an email the user no longer has", async () => {
    const { service, users, mail } = buildService();
    const user = await seedUnverifiedUser(users);
    await service.requestVerification(user.id, meta);
    const token = mail.sent[0].body.match(/: ([0-9a-f]+)$/)![1];

    await users.update(user.id, { email: "changed@test.com" });

    await expect(service.confirmVerification({ token }, meta)).rejects.toThrow(ValidationError);
  });
});
