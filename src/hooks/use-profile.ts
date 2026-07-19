"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { Transaction, Match } from "@prisma/client";

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
    queryFn: () => fetchJson<{ transactions: Transaction[] }>("/api/transactions"),
  });
}

export function useMatchesList() {
  return useQuery({
    queryKey: ["matches-history"],
    queryFn: () => fetchJson<{ matches: Match[] }>("/api/matches"),
  });
}

export interface NetworkNode {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  createdAt: string;
  active: boolean;
  deposited: boolean;
  depositCount: number;
  commissionCents: number;
  children: NetworkNode[];
}

export interface ReferralLevel {
  level: number;
  ratePct: number;
  invited: number;
  depositors: number;
  commissionCents: number;
}

export interface ReferralStats {
  referralCode: string;
  linkPath: string;
  levels: ReferralLevel[];
  tree: NetworkNode[];
  totals: {
    invited: number;
    networkSize: number;
    depositors: number;
    commissionCents: number;
  };
}

export function useReferralStats() {
  return useQuery({
    queryKey: ["referral-stats"],
    queryFn: () => fetchJson<ReferralStats>("/api/referrals"),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      fetchJson<{ ok: boolean }>("/api/user/password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
