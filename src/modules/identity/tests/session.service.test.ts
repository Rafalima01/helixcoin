import { describe, expect, it, vi, beforeEach } from "vitest";
import { SessionService } from "@/modules/identity/services/session.service";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { CreateSessionRecord } from "@/modules/identity/interfaces/session-repository.interface";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return { ...actual, revokeFamily: vi.fn(), blacklistFamilyAccessTokens: vi.fn() };
});

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };

function buildService() {
  const sessions = new InMemoryUserSessionRepository();
  return { service: new SessionService(sessions), sessions };
}

function sessionRecord(overrides: Partial<CreateSessionRecord> = {}): CreateSessionRecord {
  return {
    id: overrides.id ?? "sess_1",
    userId: overrides.userId ?? "user_1",
    familyId: overrides.familyId ?? overrides.id ?? "sess_1",
    ip: null,
    userAgent: null,
    os: null,
    browser: null,
    device: null,
    rememberMe: false,
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

describe("SessionService.listSessions", () => {
  it("returns only the given user's sessions", async () => {
    const { service, sessions } = buildService();
    await sessions.create(sessionRecord({ id: "a", userId: "user_1" }));
    await sessions.create(sessionRecord({ id: "b", userId: "user_2" }));

    const result = await service.listSessions("user_1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });
});

describe("SessionService.revokeSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NotFoundError for an unknown session", async () => {
    const { service } = buildService();
    await expect(service.revokeSession("user_1", "does-not-exist", meta)).rejects.toThrow(NotFoundError);
  });

  it("throws ForbiddenError when the session belongs to a different user", async () => {
    const { service, sessions } = buildService();
    await sessions.create(sessionRecord({ id: "a", userId: "user_1" }));
    await expect(service.revokeSession("user_2", "a", meta)).rejects.toThrow(ForbiddenError);
  });

  it("revokes the session when it belongs to the caller", async () => {
    const { service, sessions } = buildService();
    await sessions.create(sessionRecord({ id: "a", userId: "user_1" }));
    await service.revokeSession("user_1", "a", meta);
    const session = await sessions.findById("a");
    expect(session!.status).toBe("REVOKED");
  });
});

describe("SessionService.revokeAllSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("revokes every active session and returns the count", async () => {
    const { service, sessions } = buildService();
    await sessions.create(sessionRecord({ id: "a", userId: "user_1" }));
    await sessions.create(sessionRecord({ id: "b", userId: "user_1" }));
    await sessions.create(sessionRecord({ id: "c", userId: "user_2" }));

    const count = await service.revokeAllSessions("user_1", meta);
    expect(count).toBe(2);
    expect((await sessions.findById("a"))!.status).toBe("REVOKED");
    expect((await sessions.findById("b"))!.status).toBe("REVOKED");
    expect((await sessions.findById("c"))!.status).toBe("ACTIVE");
  });

  it("excludes the caller's current session when exceptSessionId is given", async () => {
    const { service, sessions } = buildService();
    await sessions.create(sessionRecord({ id: "a", userId: "user_1" }));
    await sessions.create(sessionRecord({ id: "b", userId: "user_1" }));

    const count = await service.revokeAllSessions("user_1", meta, "a");
    expect(count).toBe(1);
    expect((await sessions.findById("a"))!.status).toBe("ACTIVE");
    expect((await sessions.findById("b"))!.status).toBe("REVOKED");
  });
});
