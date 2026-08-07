"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CommercialWithdrawRole = "AFFILIATE" | "MANAGER";

export interface PixKeyDto {
  id: string;
  type: string;
  keyMasked: string;
  holderCpf: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialWithdrawDto {
  id: string;
  payeeRole: string;
  amountCents: number;
  status: string;
  pixKeyMasked: string;
  pixKeyType: string;
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
}

/** Same envelope every createRouteHandler-backed endpoint returns (see src/hooks/use-wallet.ts's envelopeFetch). */
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

function basePath(role: CommercialWithdrawRole): string {
  return role === "AFFILIATE" ? "/api/affiliate" : "/api/manager";
}

// ---------------------------------------------------------------------------
// PIX keys
// ---------------------------------------------------------------------------

export function usePixKeys(role: CommercialWithdrawRole) {
  return useQuery({
    queryKey: ["commercial", role, "pix-keys"],
    queryFn: () => envelopeFetch<PixKeyDto[]>(`${basePath(role)}/pix-keys`),
  });
}

export interface CreatePixKeyInput {
  type: string;
  key: string;
  holderCpf: string;
}

export function useCreatePixKey(role: CommercialWithdrawRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePixKeyInput) =>
      envelopeFetch<PixKeyDto>(`${basePath(role)}/pix-keys`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commercial", role, "pix-keys"] }),
  });
}

export function useUpdatePixKey(role: CommercialWithdrawRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreatePixKeyInput> & { id: string }) =>
      envelopeFetch<PixKeyDto>(`${basePath(role)}/pix-keys/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commercial", role, "pix-keys"] }),
  });
}

export function useDeletePixKey(role: CommercialWithdrawRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => envelopeFetch<{ deleted: boolean }>(`${basePath(role)}/pix-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commercial", role, "pix-keys"] }),
  });
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------

export function useCommercialWithdrawals(role: CommercialWithdrawRole) {
  return useQuery({
    queryKey: ["commercial", role, "withdrawals"],
    queryFn: () => envelopeFetch<CommercialWithdrawDto[]>(`${basePath(role)}/withdrawals`),
  });
}

export interface RequestCommercialWithdrawInput {
  amount: number;
  pixKeyId: string;
}

export function useRequestCommercialWithdraw(role: CommercialWithdrawRole) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestCommercialWithdrawInput) =>
      envelopeFetch<CommercialWithdrawDto>(`${basePath(role)}/withdrawals`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial", role, "withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
