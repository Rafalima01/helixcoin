"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Transaction, Match } from "@prisma/client";

interface WalletResponse {
  balance: number;
  recentTransactions: Transaction[];
  recentMatches: Match[];
  user: {
    name: string;
    email: string;
    image: string | null;
    referralCode: string;
    xp: number;
    level: number;
  } | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro na requisição");
  return json as T;
}

export const WALLET_QUERY_KEY = ["wallet"];

export function useWallet() {
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: () => fetchJson<WalletResponse>("/api/wallet"),
  });
}

export function useCreateDeposit() {
  return useMutation({
    mutationFn: (amount: number) =>
      fetchJson<{ transactionId: string; pixCode: string; amount: number }>("/api/wallet/deposit", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
  });
}

export function useConfirmDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      fetchJson<{ balance: number }>("/api/wallet/deposit/confirm", {
        method: "POST",
        body: JSON.stringify({ transactionId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}

export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; pixKey: string }) =>
      fetchJson<{ balance: number }>("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}
