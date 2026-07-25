import { create } from "zustand";
import { getMultiplierForPlatforms } from "@/lib/multiplier";

export type GameStatus = "idle" | "playing" | "resolving" | "won" | "lost";

interface GameState {
  status: GameStatus;
  matchId: string | null;
  /** Per-match secret (src/modules/match-engine) — required on every begin/progress/resolve call. */
  matchToken: string | null;
  betAmountCents: number;
  platformsPassed: number;
  multiplier: number;
  payoutCents: number;
  /** Consecutive rings passed without touching a platform (fire charge). */
  combo: number;
  /** Highest `combo` ever reached this match — reported to the backend as "longestStreak". */
  maxCombo: number;
  /** Bounces/contacts this match — reported to the backend as "collisionCount". */
  collisionCount: number;
  /** Peak |vertical speed| observed at a bounce — reported to the backend for anti-cheat plausibility checks. */
  maxVerticalSpeed: number;
  fireMode: boolean;
  /** Admin-controlled target multiplier ("meta") — read-only on the frontend. */
  targetMultiplier: number;
  /** Server-computed goal value in cents (bet × target). */
  goalAmountCents: number;
  goalReached: boolean;
  startedAt: number | null;

  startMatch: (
    matchId: string,
    matchToken: string,
    betAmountCents: number,
    targetMultiplier: number,
    goalAmountCents: number
  ) => void;
  /** Credit `count` platform passes (bonus segments credit more than one). */
  registerPass: (count?: number) => void;
  /** Ball touched a platform — combo resets. `impactSpeed` (if known) feeds the anti-cheat telemetry peak. */
  registerTouch: (impactSpeed?: number) => void;
  setFire: (on: boolean) => void;
  setResolving: () => void;
  resolveWon: (payoutCents: number, multiplier: number) => void;
  resolveLost: () => void;
  reset: () => void;
}

const INITIAL_TELEMETRY = {
  combo: 0,
  maxCombo: 0,
  collisionCount: 0,
  maxVerticalSpeed: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  status: "idle",
  matchId: null,
  matchToken: null,
  betAmountCents: 0,
  platformsPassed: 0,
  multiplier: 1,
  payoutCents: 0,
  ...INITIAL_TELEMETRY,
  fireMode: false,
  targetMultiplier: 5,
  goalAmountCents: 0,
  goalReached: false,
  startedAt: null,

  startMatch: (matchId, matchToken, betAmountCents, targetMultiplier, goalAmountCents) =>
    set({
      status: "playing",
      matchId,
      matchToken,
      betAmountCents,
      platformsPassed: 0,
      multiplier: 1,
      payoutCents: 0,
      ...INITIAL_TELEMETRY,
      fireMode: false,
      targetMultiplier,
      goalAmountCents,
      goalReached: false,
      startedAt: Date.now(),
    }),

  registerPass: (count = 1) => {
    const { platformsPassed: prev, combo, maxCombo, targetMultiplier, goalReached } = get();
    const platformsPassed = prev + count;
    const multiplier = getMultiplierForPlatforms(platformsPassed);
    const nextCombo = combo + count;
    set({
      platformsPassed,
      multiplier,
      combo: nextCombo,
      maxCombo: Math.max(maxCombo, nextCombo),
      goalReached: goalReached || (targetMultiplier > 1 && multiplier >= targetMultiplier - 1e-9),
    });
  },

  registerTouch: (impactSpeed) => {
    const { collisionCount, maxVerticalSpeed } = get();
    set({
      combo: 0,
      collisionCount: collisionCount + 1,
      maxVerticalSpeed: impactSpeed !== undefined ? Math.max(maxVerticalSpeed, impactSpeed) : maxVerticalSpeed,
    });
  },

  setFire: (on) => set({ fireMode: on, ...(on ? {} : { combo: 0 }) }),

  setResolving: () => set({ status: "resolving" }),

  resolveWon: (payoutCents, multiplier) => set({ status: "won", payoutCents, multiplier }),

  resolveLost: () => set({ status: "lost", payoutCents: 0, fireMode: false }),

  reset: () =>
    set({
      status: "idle",
      matchId: null,
      matchToken: null,
      betAmountCents: 0,
      platformsPassed: 0,
      multiplier: 1,
      payoutCents: 0,
      ...INITIAL_TELEMETRY,
      fireMode: false,
      targetMultiplier: 5,
      goalAmountCents: 0,
      goalReached: false,
      startedAt: null,
    }),
}));
