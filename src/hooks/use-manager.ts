"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManagerProfileDto, ManagerDashboardDto, ManagerLinksDto } from "@/modules/manager/dto/manager.dto";
import type { AffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";
import type { AffiliateDecisionAction } from "@/modules/affiliate/services/affiliate.service";

/** Every /api/manager/* route goes through createRouteHandler's standard `{data}`/`{error:{code,message}}` envelope. */
async function envelopeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro na requisição");
  return json.data as T;
}

export const MANAGER_PROFILE_QUERY_KEY = ["manager", "me"];
export const MANAGER_DASHBOARD_QUERY_KEY = ["manager", "dashboard"];
export const MANAGER_APPROVALS_QUERY_KEY = ["manager", "approvals"];
export const MANAGER_NETWORK_QUERY_KEY = ["manager", "network"];
export const MANAGER_LINKS_QUERY_KEY = ["manager", "links"];

export function useManagerProfile() {
  return useQuery({
    queryKey: MANAGER_PROFILE_QUERY_KEY,
    queryFn: () => envelopeFetch<ManagerProfileDto>("/api/manager/me"),
  });
}

export function useManagerDashboard() {
  return useQuery({
    queryKey: MANAGER_DASHBOARD_QUERY_KEY,
    queryFn: () => envelopeFetch<ManagerDashboardDto>("/api/manager/dashboard"),
  });
}

export function useManagerApprovals() {
  return useQuery({
    queryKey: MANAGER_APPROVALS_QUERY_KEY,
    queryFn: () => envelopeFetch<AffiliateProfileAdminDto[]>("/api/manager/approvals"),
  });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: AffiliateDecisionAction; reason?: string }) =>
      envelopeFetch<AffiliateProfileAdminDto>(`/api/manager/approvals/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANAGER_APPROVALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MANAGER_NETWORK_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MANAGER_DASHBOARD_QUERY_KEY });
    },
  });
}

export function useManagerNetwork() {
  return useQuery({
    queryKey: MANAGER_NETWORK_QUERY_KEY,
    queryFn: () => envelopeFetch<AffiliateProfileAdminDto[]>("/api/manager/network"),
  });
}

export function useManagerLinks() {
  return useQuery({
    queryKey: MANAGER_LINKS_QUERY_KEY,
    queryFn: () => envelopeFetch<ManagerLinksDto>("/api/manager/links"),
  });
}

export function useUpdateNetworkAffiliateCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ affiliateId, percent }: { affiliateId: string; percent: number }) =>
      envelopeFetch<AffiliateProfileAdminDto>(`/api/manager/network/${affiliateId}/commission`, {
        method: "PATCH",
        body: JSON.stringify({ percent }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANAGER_NETWORK_QUERY_KEY });
    },
  });
}

export function useUpdateNetworkAffiliateInvitePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ affiliateId, canInviteAffiliates }: { affiliateId: string; canInviteAffiliates: boolean }) =>
      envelopeFetch<AffiliateProfileAdminDto>(`/api/manager/network/${affiliateId}/invite-permission`, {
        method: "PATCH",
        body: JSON.stringify({ canInviteAffiliates }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANAGER_NETWORK_QUERY_KEY });
    },
  });
}
