"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro na requisição");
  return json as T;
}

export const GAME_CONFIG_QUERY_KEY = ["game-config"];

/** Platform-controlled game settings (read-only on the frontend). */
export function useGameConfig() {
  return useQuery({
    queryKey: GAME_CONFIG_QUERY_KEY,
    queryFn: () => fetchJson<{ targetMultiplier: number }>("/api/config"),
    staleTime: 60_000,
  });
}
