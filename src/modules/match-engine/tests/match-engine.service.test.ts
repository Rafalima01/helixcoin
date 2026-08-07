import { describe, expect, it } from "vitest";
import { MatchEngineService } from "@/modules/match-engine/services/match-engine.service";
import { InMemoryMatchRepository } from "@/modules/match-engine/repositories/match.in-memory-repository";
import { InMemoryMatchEventRepository } from "@/modules/match-engine/repositories/match-event.in-memory-repository";
import { InMemoryWalletLedger } from "@/modules/match-engine/repositories/wallet-ledger.in-memory-repository";
import { FakeGameConfigResolver } from "@/modules/match-engine/repositories/game-config-resolver.in-memory-repository";
import type { ResolvedMatchConfig } from "@/modules/match-engine/interfaces/game-config-resolver.interface";
import {
  buildDefaultAntiCheat,
  buildDefaultModes,
} from "@/modules/game-config/utils/config-defaults.util";
import { NotFoundError, ForbiddenError, BusinessRuleError } from "@/server/errors";

const meta = { ip: "127.0.0.1", userAgent: "vitest", device: "Desktop", os: "Test OS" };

/** Permissive limits — no timing/rate constraints — so happy-path tests aren't flaky against real wall-clock execution speed. */
function lenientConfig(overrides?: Partial<ResolvedMatchConfig["general"]>): ResolvedMatchConfig {
  return {
    mode: "NORMAL",
    configVersion: 1,
    general: {
      betMin: 100,
      betMax: 2_000_000,
      targetMultiplierDefault: 5,
      goalMultiplierMin: 1.2,
      goalMultiplierMax: 50,
      ...overrides,
    },
    // Infinity, not just "generously large" — real elapsedSeconds between
    // begin() and the next call in a synchronous test can be a fraction of
    // a millisecond, which would blow past any finite platforms/second
    // ceiling regardless of how high it's set.
    antiCheat: {
      maxPlatformsPerSecond: Infinity,
      minSecondsToGoal: 0,
      minSecondsBeforeCashout: 0,
      maxVerticalSpeed: Infinity,
      maxCollisionsPerSecond: Infinity,
    },
    engineParams: buildDefaultModes().NORMAL,
    maintenanceMode: false,
  };
}

/** The real, tuned default limits — used specifically to prove anti-cheat actually fires under normal (strict) config. */
function strictConfig(): ResolvedMatchConfig {
  return {
    ...lenientConfig(),
    antiCheat: buildDefaultAntiCheat() as unknown as ResolvedMatchConfig["antiCheat"],
  };
}

function buildService(config: ResolvedMatchConfig = lenientConfig()) {
  const matches = new InMemoryMatchRepository();
  const matchEvents = new InMemoryMatchEventRepository();
  const wallet = new InMemoryWalletLedger();
  const gameConfig = new FakeGameConfigResolver(config);
  const service = new MatchEngineService(matches, matchEvents, wallet, gameConfig);
  return { service, matches, matchEvents, wallet, gameConfig };
}

const USER_ID = "user-1";

describe("MatchEngineService", () => {
  it("create() debits the wallet, snapshots the config, and lands on AWAITING_START", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);

    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);

    expect(match.status).toBe("AWAITING_START");
    expect(match.betAmount).toBe(500);
    expect(match.balanceBefore).toBe(10_000);
    expect(match.goalAmount).toBe(2500);
    expect(match.mode).toBe("NORMAL");
    expect(match.matchNumber).toMatch(/^HJ-/);
    expect(token).toHaveLength(48);
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(9_500);
  });

  it("create() rejects a bet below the configured minimum", async () => {
    const { service, wallet } = buildService(lenientConfig({ betMin: 1000 }));
    wallet.setBalance(USER_ID, 10_000);
    await expect(service.create(USER_ID, { amount: 1 }, meta)).rejects.toThrow(BusinessRuleError);
  });

  it("create() rejects an insufficient balance and persists nothing", async () => {
    const { service, matches, wallet } = buildService();
    wallet.setBalance(USER_ID, 100);
    await expect(service.create(USER_ID, { amount: 5 }, meta)).rejects.toThrow(BusinessRuleError);
    await expect(matches.listAdmin({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });

  it("create() rejects new matches while maintenanceMode is on and persists nothing", async () => {
    const { service, matches, wallet } = buildService({ ...lenientConfig(), maintenanceMode: true });
    wallet.setBalance(USER_ID, 10_000);
    await expect(service.create(USER_ID, { amount: 5 }, meta)).rejects.toThrow(BusinessRuleError);
    await expect(matches.listAdmin({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(10_000);
  });

  it("begin() transitions AWAITING_START to IN_PROGRESS and stamps startedAt", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);

    const started = await service.begin(match.id, USER_ID, token);
    expect(started.status).toBe("IN_PROGRESS");
    expect(started.startedAt).toBeInstanceOf(Date);
  });

  it("begin() rejects a wrong token", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match } = await service.create(USER_ID, { amount: 5 }, meta);
    await expect(service.begin(match.id, USER_ID, "wrong-token-".repeat(3))).rejects.toThrow(ForbiddenError);
  });

  it("begin() rejects a different user's match", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await expect(service.begin(match.id, "someone-else", token)).rejects.toThrow(NotFoundError);
  });

  it("reportProgress() reaching the goal auto-transitions GOAL_REACHED -> CASHOUT_AVAILABLE", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);

    // Anchor [15, 5] in MULTIPLIER_ANCHORS — exactly the default target multiplier.
    const progressed = await service.reportProgress(match.id, USER_ID, { token, platformsPassed: 15 });
    expect(progressed.status).toBe("CASHOUT_AVAILABLE");
    expect(progressed.multiplier).toBeCloseTo(5, 5);
    expect(progressed.potentialPayout).toBe(2500);
  });

  it("reportProgress() below the goal stays IN_PROGRESS", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);

    const progressed = await service.reportProgress(match.id, USER_ID, { token, platformsPassed: 3 });
    expect(progressed.status).toBe("IN_PROGRESS");
    expect(progressed.multiplier).toBeLessThan(5);
  });

  it("resolve(cashout) pays out and credits the wallet once CASHOUT_AVAILABLE", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);
    await service.reportProgress(match.id, USER_ID, { token, platformsPassed: 15 });

    const resolved = await service.resolve(match.id, USER_ID, { token, action: "cashout", platformsPassed: 15 });
    expect(resolved.status).toBe("CASHED_OUT");
    expect(resolved.payout).toBe(2500);
    expect(resolved.balanceAfter).toBe(9_500 + 2500);
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(9_500 + 2500);
  });

  it("resolve(cashout) is denied before the goal is reached and never pays out", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);
    await service.reportProgress(match.id, USER_ID, { token, platformsPassed: 3 });

    await expect(
      service.resolve(match.id, USER_ID, { token, action: "cashout", platformsPassed: 3 })
    ).rejects.toThrow(BusinessRuleError);
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(9_500);
  });

  it("resolve(loss) ends the match with no payout and no wallet change", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);

    const resolved = await service.resolve(match.id, USER_ID, { token, action: "loss", platformsPassed: 4 });
    expect(resolved.status).toBe("LOST");
    expect(resolved.payout).toBe(0);
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(9_500);
  });

  it("resolve(forfeit) cancels the match and refunds the bet", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);

    const resolved = await service.resolve(match.id, USER_ID, { token, action: "forfeit", platformsPassed: 1 });
    expect(resolved.status).toBe("CANCELLED");
    expect(resolved.balanceAfter).toBe(10_000);
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(10_000);
  });

  it("resolve() is idempotent — resolving an already-terminal match just returns it, no double payout", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);
    await service.reportProgress(match.id, USER_ID, { token, platformsPassed: 15 });
    await service.resolve(match.id, USER_ID, { token, action: "cashout", platformsPassed: 15 });

    const second = await service.resolve(match.id, USER_ID, { token, action: "cashout", platformsPassed: 15 });
    expect(second.status).toBe("CASHED_OUT");
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(9_500 + 2500);
  });

  it("resolve() invalidates a match whose reported progress is implausible under strict anti-cheat limits, and refunds the bet (default invalidation policy)", async () => {
    const { service, wallet } = buildService(strictConfig());
    wallet.setBalance(USER_ID, 10_000);
    const { match, token } = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(match.id, USER_ID, token);

    // 15 platforms reported near-instantly after begin() — real wall-clock
    // elapsed time here is milliseconds, far below minSecondsToGoal (5s).
    const resolved = await service.resolve(match.id, USER_ID, { token, action: "cashout", platformsPassed: 15 });
    expect(resolved.status).toBe("INVALIDATED");
    expect(resolved.payout).toBe(0);
    expect(resolved.invalidationReason).toBeTruthy();
    // ANTI_CHEAT_INVALIDATION_POLICY defaults to "refund_bet_only" — the
    // debited bet comes back, unlike a plain LOST match.
    expect(resolved.balanceAfter).toBe(10_000);
    await expect(wallet.getBalance(USER_ID)).resolves.toBe(10_000);
  });

  it("listForUser only returns terminal matches, most recent first", async () => {
    const { service, wallet } = buildService();
    wallet.setBalance(USER_ID, 100_000);
    const first = await service.create(USER_ID, { amount: 5 }, meta);
    await service.begin(first.match.id, USER_ID, first.token);
    await service.resolve(first.match.id, USER_ID, { token: first.token, action: "loss", platformsPassed: 2 });

    const second = await service.create(USER_ID, { amount: 5 }, meta);
    // Still AWAITING_START — must not show up in history yet.

    const history = await service.listForUser(USER_ID, 10);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(first.match.id);
    void second;
  });
});
