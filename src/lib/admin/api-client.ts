/**
 * Shared client-side fetch wrapper for admin API modules. Every module under
 * src/lib/admin/*-api.ts used to hand-roll its own copy of this — same
 * `{ data, meta? }` / `{ error }` envelope, same `ApiError` shape — which is
 * why the fix below has to live in exactly one place.
 *
 * The bug this fixes: `JWT_ACCESS_TTL` is 15 minutes (.env). proxy.ts
 * already silently refreshes an expired access token using the long-lived
 * refresh-token cookie, but ONLY for page navigations — its matcher
 * explicitly excludes `/api` (`matcher: ["/((?!api|...).*)"]`), by design,
 * so that renewal never runs for a client-side `fetch()` POST. An admin
 * panel like /admin/rtp is a long-lived single page — an admin can spend
 * more than 15 minutes tuning sliders before clicking "Salvar rascunho" —
 * so every request from then on 401s with "Authentication required" even
 * though the refresh-token cookie (30d) is still perfectly valid. Reloading
 * the page "fixes" it only because that re-enters proxy.ts's navigation
 * path. This wrapper does the same silent refresh for API calls: on a 401,
 * call `/api/auth/refresh` once and retry the original request exactly
 * once before giving up.
 *
 * `refreshInFlight` de-dupes concurrent 401s into a single refresh call —
 * not just an optimization: refresh tokens ROTATE on use (tokens.ts), so two
 * requests racing to refresh with the same pre-rotation token would make the
 * second look like refresh-token reuse and get flagged by theft detection.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function request<T>(url: string, init?: RequestInit): Promise<{ data: T; meta?: PaginationMeta }> {
  const doFetch = () => fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });

  let res = await doFetch();
  if (res.status === 401 && (await refreshSession())) {
    res = await doFetch();
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? "Erro na requisição", json?.error?.code ?? "UNKNOWN");
  }
  return json;
}
