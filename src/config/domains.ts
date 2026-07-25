/**
 * The single source of truth for every cross-zone URL in the app — see
 * AGENTS.md "Fase Deploy: Domínios/Subdomínios/Produção". Nothing else in
 * the codebase should read `process.env.NEXT_PUBLIC_*URL*` or hardcode a
 * `helixcoin.bet`/`admin.localhost`/etc. host — import from here instead, on
 * both the server (route handlers, services building invite links) and the
 * client (nav, "troca de zona" links).
 *
 * Safe to import from client components: every value here is `NEXT_PUBLIC_`
 * (public by design, never a secret — just a base URL) and is read directly
 * from `process.env`, not from `@/server/config/env` (which pulls in
 * DATABASE_URL/JWT secrets/etc. and would break if bundled client-side).
 * `@/server/config/env` still separately declares and Zod-validates these
 * same vars so a malformed URL fails the boot fast — this module is the
 * runtime-value source, that one is the fail-fast gate.
 *
 * Dev defaults use named `*.localhost` subdomains for every zone, including
 * the player zone (`player.localhost`, not bare `localhost`) — seeing
 * `src/proxy.ts`'s file-level comment for why bare `localhost` as the player
 * origin breaks cross-zone redirects in this Next.js version's dev server.
 */
export const PLAYER_URL = process.env.NEXT_PUBLIC_PLAYER_URL ?? "http://player.localhost:3000";
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://admin.localhost:3000";
export const MANAGER_URL = process.env.NEXT_PUBLIC_MANAGER_URL ?? "http://manager.localhost:3000";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://api.localhost:3000";

/**
 * Cookie `Domain` attribute for auth cookies (src/server/auth/cookies.ts).
 * Empty string (the default, and always the value in dev) means "omit the
 * Domain attribute" — the browser then scopes the cookie to the exact host
 * that set it (host-only cookie). In **production**, this should be set to
 * `.helixcoin.bet` (see DEPLOYMENT.md's "Cookies entre subdomínios") so a
 * session is *visible* to every `*.helixcoin.bet` zone — that's what lets
 * `src/proxy.ts` recognize "this is a Player session" the moment the
 * browser hits `admin.helixcoin.bet` and redirect it automatically,
 * instead of only detecting the mismatch after the visitor manually logs
 * in on the wrong zone's own form. Sharing the cookie does NOT grant
 * cross-zone access by itself — the middleware's role gate is still the
 * actual authorization boundary (`hasRole`/`role === "MANAGER"` in
 * `src/proxy.ts`); this only controls whether a session is *visible*
 * across zones, never whether it's *authorized* in one it isn't.
 */
export const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? "";

export type Zone = "player" | "admin" | "manager";

const ZONE_URLS: Record<Zone, string> = {
  player: PLAYER_URL,
  admin: ADMIN_URL,
  manager: MANAGER_URL,
};

/**
 * The only sanctioned way to build a link into another zone — never
 * concatenate a domain string manually. `path` is resolved against the
 * target zone's origin exactly like `new URL(path, base)`, so both
 * `"/r/CODE"` and `"r/CODE"` work and query strings/fragments are preserved.
 */
export function zoneUrl(zone: Zone, path = "/"): string {
  return new URL(path, ZONE_URLS[zone]).toString();
}
