"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TemplateItemResponseDto } from "@/modules/_template/dto/template-item.dto";

/**
 * Frontend integration pattern: a typed fetch wrapper decoding server/http's
 * `{ data }` envelope, feeding React Query — the shape every future
 * module's hooks/ folder follows (see src/hooks/use-wallet.ts for the
 * pre-existing convention this formalizes). Talks to the real reference
 * endpoint (src/app/api/template-reference/template-items) — this hook
 * works if you call it, it's just not rendered by any screen.
 */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

const QUERY_KEY = ["_template", "template-items"];

export function useTemplateItems() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchJson<TemplateItemResponseDto[]>("/api/template-reference/template-items"),
  });
}

export function useCreateTemplateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson<TemplateItemResponseDto>("/api/template-reference/template-items", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
