"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WalletTransaction, Match } from "@prisma/client";

interface WalletResponse {
  balance: number;
  recentTransactions: WalletTransaction[];
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

/** GET /api/wallet stays on the plain bare-JSON shape (a read, never touched by the "route through WalletService" rule). */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erro na requisição");
  return json as T;
}

/** Payments routes (src/modules/payments) go through createRouteHandler, which uses the standard `{ data }` / `{ error: { code, message } }` envelope — same as every other post-Phase-2 route. */
async function envelopeFetch<T>(url: string, init?: RequestInit): Promise<T> {
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

export const WALLET_QUERY_KEY = ["wallet"];

export function useWallet() {
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: () => fetchJson<WalletResponse>("/api/wallet"),
  });
}

export interface CreateDepositResult {
  depositId: string;
  pixCode: string;
  qrCodeUrl: string | null;
  expiresAt: string | null;
  amountCents: number;
  status: string;
  canSimulate: boolean;
}

export interface PaymentLimits {
  depositMin: number;
  depositMax: number;
  withdrawMin: number;
  withdrawMax: number;
}

/** GET /api/payments/limits — the same PaymentSettings the admin "Limites financeiros" screen edits. */
export function usePaymentLimits() {
  return useQuery({
    queryKey: ["payments", "limits"],
    queryFn: () => fetchJson<PaymentLimits>("/api/payments/limits"),
  });
}

/** POST /api/payments/deposits — the backend picks the gateway (routing/failover); the frontend never learns which one. */
export function useCreateDeposit() {
  return useMutation({
    mutationFn: (amount: number) =>
      envelopeFetch<CreateDepositResult>("/api/payments/deposits", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
  });
}

/** POST /api/payments/deposits/{id}/simulate — Mock-only demo action, replaces the old useConfirmDeposit. */
export function useSimulateDepositPayment(depositId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!depositId) throw new Error("Nenhum depósito em andamento");
      return envelopeFetch<{ status: number }>(`/api/payments/deposits/${depositId}/simulate`, {
        method: "POST",
        body: JSON.stringify({ outcome: "PAID" }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}

export interface RequestWithdrawResult {
  withdrawId: string;
  status: string;
  amountCents: number;
}

/** POST /api/payments/withdrawals — funds are locked immediately; `status` is always "PENDING" here, never an assumed-final balance. */
export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; pixKey: string; pixKeyType: string }) =>
      envelopeFetch<RequestWithdrawResult>("/api/payments/withdrawals", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
  });
}
