"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WALLET_QUERY_KEY } from "@/hooks/use-wallet";

/** Every /api/matches/** route now goes through src/modules/match-engine's standard `{ data }` / `{ error: { code, message } }` envelope. */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Erro na requisição");
  }
  return json.data as T;
}

export interface StartMatchResponse {
  matchId: string;
  matchNumber: string;
  /** Per-match secret — required on every subsequent begin/progress/resolve call, never sent again after this. */
  token: string;
  seed: string;
  betAmount: number;
  targetMultiplier: number;
  goalAmount: number;
  mode: "DEMO" | "NORMAL" | "HARD";
  configVersion: number | null;
  engineParams: Record<string, number | boolean>;
}

export function useStartMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      fetchJson<StartMatchResponse>("/api/matches/start", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}

export interface MatchProgressResponse {
  matchId: string;
  status: string;
  platformsPassed: number;
  multiplier: number;
  potentialPayout: number;
  goalReached: boolean;
  cashoutAvailable: boolean;
}

/** AWAITING_START → IN_PROGRESS — fired once the engine actually mounts, deliberately not awaited before rendering (see play-screen.tsx). */
export function useBeginMatch() {
  return useMutation({
    mutationFn: ({ matchId, token }: { matchId: string; token: string }) =>
      fetchJson<MatchProgressResponse>(`/api/matches/${matchId}/begin`, {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
  });
}

export interface ReportProgressInput {
  matchId: string;
  token: string;
  platformsPassed: number;
  collisionCount?: number;
  longestStreak?: number;
  avgSpeed?: number;
  maxVerticalSpeed?: number;
}

/** Periodic aggregate checkpoint (see src/modules/match-engine) — not called once per platform/collision, just every few seconds. */
export function useReportMatchProgress() {
  return useMutation({
    mutationFn: ({ matchId, ...body }: ReportProgressInput) =>
      fetchJson<MatchProgressResponse>(`/api/matches/${matchId}/progress`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export interface ResolveMatchInput {
  matchId: string;
  token: string;
  action: "cashout" | "loss" | "forfeit";
  platformsPassed: number;
  collisionCount?: number;
  longestStreak?: number;
  avgSpeed?: number;
  maxVerticalSpeed?: number;
}

export interface ResolveMatchResponse {
  matchId: string;
  status: string;
  multiplier: number;
  payout: number;
  balanceAfter: number | null;
}

export function useResolveMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, ...body }: ResolveMatchInput) =>
      fetchJson<ResolveMatchResponse>(`/api/matches/${matchId}/resolve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}
