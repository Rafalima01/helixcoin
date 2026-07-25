"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AffiliateMyProfileDto,
  AffiliateLinkDto,
  CommissionHistoryDto,
  AffiliateDashboardDto,
} from "@/modules/affiliate/dto/affiliate.dto";
import type { PaginationMeta } from "@/server/http/pagination";

/** Every /api/affiliate/* route goes through createRouteHandler's standard `{data}`/`{error:{code,message}}` envelope. */
async function envelopeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro na requisição");
  return json.data as T;
}

async function envelopeFetchWithMeta<T>(
  url: string,
  init?: RequestInit
): Promise<{ data: T; meta?: PaginationMeta }> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro na requisição");
  return { data: json.data as T, meta: json.meta as PaginationMeta | undefined };
}

export const AFFILIATE_PROFILE_QUERY_KEY = ["affiliate", "me"];
export const AFFILIATE_DASHBOARD_QUERY_KEY = ["affiliate", "dashboard"];
export const AFFILIATE_LINKS_QUERY_KEY = ["affiliate", "links"];

/** `data` is `null` when the player has no affiliate profile yet (see handleGetMyAffiliateProfile) — the integrated panel branches its RBAC state on this. */
export function useAffiliateProfile() {
  return useQuery({
    queryKey: AFFILIATE_PROFILE_QUERY_KEY,
    queryFn: () => envelopeFetch<AffiliateMyProfileDto | null>("/api/affiliate/me"),
    retry: false,
  });
}

export function useApplyAffiliate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { managerCode?: string; pixKey?: string }) =>
      envelopeFetch<AffiliateMyProfileDto>("/api/affiliate/apply", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AFFILIATE_PROFILE_QUERY_KEY }),
  });
}

export function useAffiliateDashboard() {
  return useQuery({
    queryKey: AFFILIATE_DASHBOARD_QUERY_KEY,
    queryFn: () => envelopeFetch<AffiliateDashboardDto>("/api/affiliate/dashboard"),
  });
}

export function useAffiliateLinks() {
  return useQuery({
    queryKey: AFFILIATE_LINKS_QUERY_KEY,
    queryFn: () => envelopeFetch<AffiliateLinkDto[]>("/api/affiliate/links"),
  });
}

export function useCreateAffiliateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      envelopeFetch<AffiliateLinkDto>("/api/affiliate/links", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AFFILIATE_LINKS_QUERY_KEY }),
  });
}

export function useSetAffiliateLinkStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "PAUSED" }) =>
      envelopeFetch<AffiliateLinkDto>(`/api/affiliate/links/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AFFILIATE_LINKS_QUERY_KEY }),
  });
}

export function useDeleteAffiliateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => envelopeFetch(`/api/affiliate/links/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AFFILIATE_LINKS_QUERY_KEY }),
  });
}

export function useAffiliateCommissions(page = 1) {
  return useQuery({
    queryKey: ["affiliate", "commissions", page],
    queryFn: () => envelopeFetchWithMeta<CommissionHistoryDto[]>(`/api/affiliate/commissions?page=${page}`),
  });
}
