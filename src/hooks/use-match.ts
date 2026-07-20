"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WALLET_QUERY_KEY } from "@/hooks/use-wallet";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro na requisição");
  return json as T;
}

export function useStartMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      fetchJson<{
        matchId: string;
        seed: string;
        betAmount: number;
        targetMultiplier: number;
        goalAmount: number;
        mode: "DEMO" | "NORMAL" | "HARD";
        configVersion: number;
        engineParams: Record<string, number | boolean>;
      }>("/api/matches/start", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}

export function useResolveMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      matchId: string;
      action: "cashout" | "loss" | "forfeit";
      platformsPassed: number;
    }) =>
      fetchJson<{ matchId: string; status: string; multiplier: number; payout: number }>(
        `/api/matches/${data.matchId}/resolve`,
        {
          method: "POST",
          body: JSON.stringify({ action: data.action, platformsPassed: data.platformsPassed }),
        }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}
