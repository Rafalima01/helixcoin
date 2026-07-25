import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signAccessToken } from "@/server/auth/jwt";

/**
 * Exercises the real route → auth guard → controller → validation → error
 * mapping chain for every /api/matches/** endpoint, the same way
 * admin-rbac.test.ts does for /api/admin/users — the service layer itself
 * (state machine, anti-cheat, wallet moves) already has dedicated unit
 * coverage in src/modules/match-engine/tests/match-engine.service.test.ts;
 * what's specific to the HTTP layer and worth proving here is: auth is
 * actually enforced, Zod validation actually rejects bad bodies, thrown
 * AppError subtypes map to the right status codes, and the /progress rate
 * limiter actually engages.
 */
const redisIncr = vi.fn().mockResolvedValue(1);
vi.mock("@/server/cache/redis", () => ({
  redis: {
    incr: (...args: unknown[]) => redisIncr(...args),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(10),
    get: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const createMock = vi.fn();
const beginMock = vi.fn();
const progressMock = vi.fn();
const resolveMock = vi.fn();
const listForUserMock = vi.fn();

vi.mock("@/modules/match-engine/container", () => ({
  matchEngineContainer: {
    matchEngineService: {
      create: (...args: unknown[]) => createMock(...args),
      begin: (...args: unknown[]) => beginMock(...args),
      reportProgress: (...args: unknown[]) => progressMock(...args),
      resolve: (...args: unknown[]) => resolveMock(...args),
      listForUser: (...args: unknown[]) => listForUserMock(...args),
    },
  },
}));

import { POST as startRoute } from "@/app/api/matches/start/route";
import { POST as beginRoute } from "@/app/api/matches/[id]/begin/route";
import { POST as progressRoute } from "@/app/api/matches/[id]/progress/route";
import { POST as resolveRoute } from "@/app/api/matches/[id]/resolve/route";
import { GET as listRoute } from "@/app/api/matches/route";
import { NotFoundError, ForbiddenError, BusinessRuleError } from "@/server/errors";

const MATCH_ID = "11111111-1111-1111-1111-111111111111";

function makeRequest(url: string, body?: unknown, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function playerToken() {
  return signAccessToken({ sub: "user-1", role: "USER", sessionId: "s1", familyId: "f1" });
}

const fakeMatch = {
  id: MATCH_ID,
  matchNumber: "HJ-ABCD1234",
  status: "AWAITING_START",
  platformsPassed: 0,
  multiplier: 1,
  targetMultiplier: 5,
  goalAmount: 2500,
  potentialPayout: 0,
  payout: null,
  balanceAfter: null,
  seed: "seed",
  mode: "NORMAL",
  configVersion: 1,
  engineParams: {},
  betAmount: 500,
};

describe("/api/matches routes (integration)", () => {
  beforeEach(() => {
    createMock.mockReset();
    beginMock.mockReset();
    progressMock.mockReset();
    resolveMock.mockReset();
    listForUserMock.mockReset();
    redisIncr.mockReset().mockResolvedValue(1);
  });

  describe("POST /api/matches/start", () => {
    it("401s with no token", async () => {
      const res = await startRoute(makeRequest("/api/matches/start", { amount: 5 }), {});
      expect(res.status).toBe(401);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("400s on a malformed body (zod validation)", async () => {
      const token = await playerToken();
      const res = await startRoute(makeRequest("/api/matches/start", { amount: "not-a-number" }, token), {});
      expect(res.status).toBe(400);
      expect(createMock).not.toHaveBeenCalled();
    });

    it("201s and returns the token exactly once on success", async () => {
      createMock.mockResolvedValue({ match: fakeMatch, token: "raw-match-token" });
      const token = await playerToken();
      const res = await startRoute(makeRequest("/api/matches/start", { amount: 5 }, token), {});
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.token).toBe("raw-match-token");
      expect(json.data.matchId).toBe(MATCH_ID);
      expect(createMock).toHaveBeenCalledWith("user-1", { amount: 5 }, expect.any(Object));
    });

    it("maps a BusinessRuleError (insufficient balance / bet out of range) to 422", async () => {
      createMock.mockRejectedValue(new BusinessRuleError("Saldo insuficiente"));
      const token = await playerToken();
      const res = await startRoute(makeRequest("/api/matches/start", { amount: 5 }, token), {});
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/matches/[id]/begin", () => {
    it("propagates a wrong-token ForbiddenError as 403", async () => {
      beginMock.mockRejectedValue(new ForbiddenError("Token de partida inválido"));
      const token = await playerToken();
      const res = await beginRoute(makeRequest(`/api/matches/${MATCH_ID}/begin`, { token: "x".repeat(32) }, token), {
        params: Promise.resolve({ id: MATCH_ID }),
      });
      expect(res.status).toBe(403);
    });

    it("propagates a not-found match as 404", async () => {
      beginMock.mockRejectedValue(new NotFoundError("Match"));
      const token = await playerToken();
      const res = await beginRoute(makeRequest(`/api/matches/${MATCH_ID}/begin`, { token: "x".repeat(32) }, token), {
        params: Promise.resolve({ id: MATCH_ID }),
      });
      expect(res.status).toBe(404);
    });

    it("200s and returns the updated status on success", async () => {
      beginMock.mockResolvedValue({ ...fakeMatch, status: "IN_PROGRESS" });
      const token = await playerToken();
      const res = await beginRoute(makeRequest(`/api/matches/${MATCH_ID}/begin`, { token: "x".repeat(32) }, token), {
        params: Promise.resolve({ id: MATCH_ID }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("IN_PROGRESS");
    });
  });

  describe("POST /api/matches/[id]/progress", () => {
    it("enforces the rate limiter before ever calling the service", async () => {
      redisIncr.mockResolvedValue(9999); // far over the configured max
      const token = await playerToken();
      const res = await progressRoute(
        makeRequest(`/api/matches/${MATCH_ID}/progress`, { token: "x".repeat(32), platformsPassed: 5 }, token),
        { params: Promise.resolve({ id: MATCH_ID }) }
      );
      expect(res.status).toBe(429);
      expect(progressMock).not.toHaveBeenCalled();
    });

    it("200s with the aggregate checkpoint result under the limit", async () => {
      progressMock.mockResolvedValue({ ...fakeMatch, status: "IN_PROGRESS", platformsPassed: 5, multiplier: 1.4 });
      const token = await playerToken();
      const res = await progressRoute(
        makeRequest(`/api/matches/${MATCH_ID}/progress`, { token: "x".repeat(32), platformsPassed: 5 }, token),
        { params: Promise.resolve({ id: MATCH_ID }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.platformsPassed).toBe(5);
      expect(json.data.cashoutAvailable).toBe(false);
    });
  });

  describe("POST /api/matches/[id]/resolve", () => {
    it("400s on an invalid action", async () => {
      const token = await playerToken();
      const res = await resolveRoute(
        makeRequest(`/api/matches/${MATCH_ID}/resolve`, { token: "x".repeat(32), action: "win", platformsPassed: 5 }, token),
        { params: Promise.resolve({ id: MATCH_ID }) }
      );
      expect(res.status).toBe(400);
      expect(resolveMock).not.toHaveBeenCalled();
    });

    it("200s with the payout on a successful cashout", async () => {
      resolveMock.mockResolvedValue({ ...fakeMatch, status: "CASHED_OUT", payout: 2500, balanceAfter: 12000, multiplier: 5 });
      const token = await playerToken();
      const res = await resolveRoute(
        makeRequest(`/api/matches/${MATCH_ID}/resolve`, { token: "x".repeat(32), action: "cashout", platformsPassed: 15 }, token),
        { params: Promise.resolve({ id: MATCH_ID }) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("CASHED_OUT");
      expect(json.data.payout).toBe(2500);
    });
  });

  describe("GET /api/matches", () => {
    it("401s with no token", async () => {
      const res = await listRoute(new NextRequest("http://localhost/api/matches"), {});
      expect(res.status).toBe(401);
    });

    it("200s with the player's own resolved-match history", async () => {
      listForUserMock.mockResolvedValue([
        {
          id: MATCH_ID,
          matchNumber: "HJ-ABCD1234",
          userId: "user-1",
          status: "LOST",
          mode: "NORMAL",
          betAmount: 500,
          multiplier: 1.7,
          payout: 0,
          platformsPassed: 6,
          riskScore: 0,
          createdAt: new Date(),
          resolvedAt: new Date(),
        },
      ]);
      const token = await playerToken();
      const res = await listRoute(
        new NextRequest("http://localhost/api/matches", { headers: { authorization: `Bearer ${token}` } }),
        {}
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(listForUserMock).toHaveBeenCalledWith("user-1", expect.any(Number));
    });
  });
});
