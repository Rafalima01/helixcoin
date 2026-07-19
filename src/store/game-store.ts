import { create } from "zustand";
import { getMultiplierForPlatforms } from "@/lib/multiplier";

export type GameStatus = "idle" | "playing" | "resolving" | "won" | "lost";

interface GameState {
  status: GameStatus;
  matchId: string | null;
  betAmountCents: number;
  platformsPassed: number;
  multiplier: number;
  payoutCents: number;
  /** Consecutive rings passed without touching a platform (fire charge). */
  combo: number;
  fireMode: boolean;
  /** Admin-controlled target multiplier ("meta") — read-only on the frontend. */
  targetMultiplier: number;
  /** Server-computed goal value in cents (bet × target). */
  goalAmountCents: number;
  goalReached: boolean;
  startedAt: number | null;

  startMatch: (
    matchId: string,
    betAmountCents: number,
    targetMultiplier: number,
    goalAmountCents: number
  ) => void;
  /** Credit `count` platform passes (bonus segments credit more than one). */
  registerPass: (count?: number) => void;
  /** Ball touched a platform — combo resets. */
  registerTouch: () => void;
  setFire: (on: boolean) => void;
  setResolving: () => void;
  resolveWon: (payoutCents: number, multiplier: number) => void;
  resolveLost: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  status: "idle",
  matchId: null,
  betAmountCents: 0,
  platformsPassed: 0,
  multiplier: 1,
  payoutCents: 0,
  combo: 0,
  fireMode: false,
  targetMultiplier: 5,
  goalAmountCents: 0,
  goalReached: false,
  startedAt: null,

  startMatch: (matchId, betAmountCents, targetMultiplier, goalAmountCents) =>
    set({
      status: "playing",
      matchId,
      betAmountCents,
      platformsPassed: 0,
      multiplier: 1,
      payoutCents: 0,
      combo: 0,
      fireMode: false,
      targetMultiplier,
      goalAmountCents,
      goalReached: false,
      startedAt: Date.now(),
    }),

  registerPass: (count = 1) => {
    const { platformsPassed: prev, combo, targetMultiplier, goalReached } = get();
    const platformsPassed = prev + count;
    const multiplier = getMultiplierForPlatforms(platformsPassed);
    set({
      platformsPassed,
      multiplier,
      combo: combo + count,
      goalReached:
        goalReached || (targetMultiplier > 1 && multiplier >= targetMultiplier - 1e-9),
    });
  },

  registerTouch: () => set({ combo: 0 }),

  setFire: (on) => set({ fireMode: on, ...(on ? {} : { combo: 0 }) }),

  setResolving: () => set({ status: "resolving" }),

  resolveWon: (payoutCents, multiplier) => set({ status: "won", payoutCents, multiplier }),

  resolveLost: () => set({ status: "lost", payoutCents: 0, fireMode: false }),

  reset: () =>
    set({
      status: "idle",
      matchId: null,
      betAmountCents: 0,
      platformsPassed: 0,
      multiplier: 1,
      payoutCents: 0,
      combo: 0,
      fireMode: false,
      targetMultiplier: 5,
      goalAmountCents: 0,
      goalReached: false,
      startedAt: null,
    }),
}));
