"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { WalletTransaction } from "@prisma/client";
import type { MatchSummaryDto } from "@/modules/match-engine/dto/match.dto";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro na requisição");
  return json as T;
}

export interface AccountStats {
  totalDeposited: number;
  totalWithdrawn: number;
  totalBet: number;
  totalPayout: number;
  cashback: number;
  balance: number;
  netProfit: number;
}

export function useAccountStats() {
  return useQuery({
    queryKey: ["account-stats"],
    queryFn: () => fetchJson<AccountStats>("/api/stats"),
  });
}

export function useTransactionsList() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: () => fetchJson<{ transactions: WalletTransaction[] }>("/api/transactions"),
  });
}

/** /api/matches (src/modules/match-engine) returns the standard `{ data }` envelope, unlike this file's other legacy routes. */
export function useMatchesList() {
  return useQuery({
    queryKey: ["matches-history"],
    queryFn: () => fetchJson<{ data: MatchSummaryDto[] }>("/api/matches").then((json) => json.data),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
      revokeOtherSessions?: boolean;
    }) => {
      const res = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Erro na requisição");
      return json;
    },
  });
}

export interface SessionInfo {
  id: string;
  ip: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  location: string | null;
  rememberMe: boolean;
  active: boolean;
  current: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

async function identityFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro na requisição");
  return json?.data as T;
}

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => identityFetch<SessionInfo[]>("/api/sessions"),
  });
}

export function useRevokeSession() {
  return useMutation({
    mutationFn: (sessionId: string) => identityFetch(`/api/sessions/${sessionId}`, { method: "DELETE" }),
  });
}

export function useRevokeAllSessions() {
  return useMutation({
    mutationFn: () => identityFetch<{ revokedCount: number }>("/api/sessions/revoke-all", { method: "POST" }),
  });
}
