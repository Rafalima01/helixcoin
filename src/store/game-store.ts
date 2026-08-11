import { create } from "zustand";
import { getMultiplierForPlatforms } from "@/lib/multiplier";

export type GameStatus = "idle" | "playing" | "resolving" | "won" | "lost";

/** One "+R$X" popup trigger — `amountCents` is always the fixed REWARD_POPUP_INCREMENT_CENTS below, never derived from the multiplier/payout curve (see registerPass). Purely a display increment; the real resolvable value stays `payoutCents`/`multiplier`, untouched by this. */
export interface RewardEvent {
  id: number;
  amountCents: number;
}

let rewardIdSeq = 0;
function nextRewardId(): number {
  rewardIdSeq += 1;
  return rewardIdSeq;
}

/**
 * Fixed, purely cosmetic per-pass reward increment for the "+R$X" popups
 * (HUD-top RewardPopups and the ball-side gain indicator both read from the
 * same rewardEvents queue this feeds). NEVER used in the real payout/RTP
 * calculation — that stays exclusively `multiplier` × `betAmountCents`
 * (see currentValueReais in @/lib/multiplier) and, at resolve time, the
 * server-computed `payoutCents`. Exists only so every platform advance
 * shows the same "+R$0,50" feedback regardless of how much the underlying
 * multiplier actually grew at that point.
 */
export const REWARD_POPUP_INCREMENT_CENTS = 50;

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
  /** Queue of "🪙 +R$X" popups the HUD should render, one per platform consumed — see reward-popups.tsx. */
  rewardEvents: RewardEvent[];

  startMatch: (
    matchId: string,
    matchToken: string,
    betAmountCents: number,
    targetMultiplier: number,
    goalAmountCents: number
  ) => void;
  /** Credit `count` platform passes and queue a fixed-amount reward popup (REWARD_POPUP_INCREMENT_CENTS per pass) — cosmetic only, never derived from the multiplier. */
  registerPass: (count?: number) => void;
  /** Ball touched a platform — combo resets. `impactSpeed` (if known) feeds the anti-cheat telemetry peak. */
  registerTouch: (impactSpeed?: number) => void;
  /** Removes a reward popup once its animation finishes — see reward-popups.tsx. */
  dismissReward: (id: number) => void;
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
  rewardEvents: [],

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
      rewardEvents: [],
    }),

  registerPass: (count = 1) => {
    const { platformsPassed: prev, combo, maxCombo, targetMultiplier, goalReached, rewardEvents } = get();
    const platformsPassed = prev + count;
    const multiplier = getMultiplierForPlatforms(platformsPassed);
    const nextCombo = combo + count;
    // Recompensa incremental exibida no popup — sempre o mesmo valor fixo
    // (REWARD_POPUP_INCREMENT_CENTS), nunca derivada do multiplicador. O
    // valor financeiro real da partida continua sendo multiplier ×
    // betAmountCents (currentValueReais) / payoutCents no resolve — este
    // popup nunca alimenta nem lê esse cálculo.
    const amountCents = REWARD_POPUP_INCREMENT_CENTS * count;
    set({
      platformsPassed,
      multiplier,
      combo: nextCombo,
      maxCombo: Math.max(maxCombo, nextCombo),
      goalReached: goalReached || (targetMultiplier > 1 && multiplier >= targetMultiplier - 1e-9),
      rewardEvents: [...rewardEvents, { id: nextRewardId(), amountCents }],
    });
  },

  dismissReward: (id) => set((s) => ({ rewardEvents: s.rewardEvents.filter((r) => r.id !== id) })),

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
      rewardEvents: [],
    }),
}));
