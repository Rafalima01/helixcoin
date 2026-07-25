import { describe, expect, it } from "vitest";
import type { MatchStatus } from "@prisma/client";
import {
  canTransition,
  assertTransition,
  isTerminalStatus,
  ACTIVE_STATUSES,
} from "@/modules/match-engine/utils/match-state-machine";
import { BusinessRuleError } from "@/server/errors";

const ALL_STATUSES: MatchStatus[] = [
  "CREATED",
  "AWAITING_START",
  "IN_PROGRESS",
  "GOAL_REACHED",
  "CASHOUT_AVAILABLE",
  "CASHED_OUT",
  "LOST",
  "CANCELLED",
  "INVALIDATED",
];

const ALLOWED: [MatchStatus, MatchStatus][] = [
  ["CREATED", "AWAITING_START"],
  ["CREATED", "CANCELLED"],
  ["AWAITING_START", "IN_PROGRESS"],
  ["AWAITING_START", "CANCELLED"],
  ["IN_PROGRESS", "GOAL_REACHED"],
  ["IN_PROGRESS", "LOST"],
  ["IN_PROGRESS", "CANCELLED"],
  ["IN_PROGRESS", "INVALIDATED"],
  ["GOAL_REACHED", "CASHOUT_AVAILABLE"],
  ["GOAL_REACHED", "LOST"],
  ["GOAL_REACHED", "CANCELLED"],
  ["GOAL_REACHED", "INVALIDATED"],
  ["CASHOUT_AVAILABLE", "CASHED_OUT"],
  ["CASHOUT_AVAILABLE", "LOST"],
  ["CASHOUT_AVAILABLE", "CANCELLED"],
  ["CASHOUT_AVAILABLE", "INVALIDATED"],
];

const ALLOWED_SET = new Set(ALLOWED.map(([f, t]) => `${f}->${t}`));

describe("match-state-machine", () => {
  it("allows exactly the documented transitions and rejects every other pair", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expected = ALLOWED_SET.has(`${from}->${to}`);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("assertTransition throws BusinessRuleError for a disallowed pair", () => {
    expect(() => assertTransition("CREATED", "IN_PROGRESS")).toThrow(BusinessRuleError);
    expect(() => assertTransition("CASHED_OUT", "IN_PROGRESS")).toThrow(BusinessRuleError);
    expect(() => assertTransition("LOST", "CASHED_OUT")).toThrow(BusinessRuleError);
  });

  it("assertTransition does not throw for an allowed pair", () => {
    expect(() => assertTransition("IN_PROGRESS", "GOAL_REACHED")).not.toThrow();
  });

  it("never allows a transition away from a terminal status", () => {
    for (const status of ["CASHED_OUT", "LOST", "CANCELLED", "INVALIDATED"] as MatchStatus[]) {
      expect(isTerminalStatus(status)).toBe(true);
      for (const to of ALL_STATUSES) {
        expect(canTransition(status, to)).toBe(false);
      }
    }
  });

  it("never allows losing or being invalidated before the match actually starts playing", () => {
    expect(canTransition("CREATED", "LOST")).toBe(false);
    expect(canTransition("CREATED", "INVALIDATED")).toBe(false);
    expect(canTransition("AWAITING_START", "LOST")).toBe(false);
    expect(canTransition("AWAITING_START", "INVALIDATED")).toBe(false);
  });

  it("ACTIVE_STATUSES matches every non-terminal status reachable after creation", () => {
    expect(new Set(ACTIVE_STATUSES)).toEqual(
      new Set(["AWAITING_START", "IN_PROGRESS", "GOAL_REACHED", "CASHOUT_AVAILABLE"])
    );
  });
});
