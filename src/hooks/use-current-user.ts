"use client";

import { useQuery } from "@tanstack/react-query";

interface CurrentUserResponse {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

async function fetchCurrentUser(): Promise<CurrentUserResponse["user"]> {
  const res = await fetch("/api/auth/me", { headers: { "Content-Type": "application/json" } });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Erro na requisição");
  return (json.data as CurrentUserResponse).user;
}

/** The authenticated staff/manager identity for the Backoffice shells (Admin topbar chip, etc.) — reuses the same GET /api/auth/me every zone already relies on, never a Backoffice-specific endpoint. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
  });
}
