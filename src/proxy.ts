import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { hasRole, ROLE_HIERARCHY } from "@/server/auth/rbac";
import { PLAYER_URL, ADMIN_URL, MANAGER_URL } from "@/config/domains";
import type { Role } from "@prisma/client";

/**
 * NOTE on PLAYER_URL's dev default (player.localhost, not bare localhost):
 * this Next.js build's dev router derives a request's "origin" from the
 * server's own bind address (localhost:3000) instead of the real `Host`
 * header, with no supported next.config way to opt out
 * (`experimental.trustHostHeader` exists in the compiled router but isn't in
 * this version's public config schema — set it and Next silently drops it).
 * Bare `http://localhost:3000` as PLAYER_URL would therefore string-collide
 * with that synthetic origin, and any redirect built from it gets its
 * Location header silently relativized by Next's own redirect normalizer
 * (getRelativeURL) — breaking exactly the role-mismatch redirect
 * `loginUrlForRole` exists to produce. See src/config/domains.ts for the
 * canonical source of PLAYER_URL/ADMIN_URL/MANAGER_URL; production is
 * unaffected by this quirk (every zone is already a distinct real domain).
 */

const PLAYER_AUTH_PREFIXES = ["/home", "/play", "/wallet", "/profile"];

/**
 * Everyone who isn't staff, Manager, or (the currently-unused) Affiliate
 * role belongs on the player domain.
 */
function loginUrlForRole(role: Role | undefined): URL {
  if (role === "MANAGER") return new URL("/login", MANAGER_URL);
  if (role && hasRole(role, ROLE_HIERARCHY)) return new URL("/login", ADMIN_URL);
  return new URL("/login", PLAYER_URL);
}

/**
 * Three exclusive doors, one Next.js app (see AGENTS.md "Fase 9: Separação
 * dos Portais + Estrutura de Domínios"): admin.{domain} and manager.{domain}
 * are host-rewritten into the existing /admin and /manager route trees —
 * invisible to the URL bar — and are the ONLY way in. Hitting /admin or
 * /manager on any other host 308s to the right subdomain instead of serving
 * the same panel twice. `*.localhost` resolves to 127.0.0.1 in every modern
 * browser/OS, so this works in dev without touching a hosts file.
 *
 * Each zone is additionally role-gated (staff roles only on admin.,
 * `MANAGER` only on manager.) — an authenticated user of the WRONG role for
 * the zone they're on is bounced to the login page of the zone that actually
 * matches their role, not just to a generic "you're not welcome here" page.
 * This is enforcement, not a new business rule: which roles are "staff" is
 * still entirely defined by `ROLE_HIERARCHY` (src/server/auth/rbac.ts), the
 * same list `/admin`'s own layout already used.
 *
 * Proxy defaults to the Node.js runtime in this Next.js version (see
 * node_modules/next/dist/docs/.../proxy.md), so this can use the full
 * `getAuthContext` (ioredis blacklist check included) directly.
 */
export default async function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  if (host.startsWith("admin.")) return handleZone(req, "/admin");
  if (host.startsWith("manager.")) return handleZone(req, "/manager");

  const pathname = req.nextUrl.pathname;

  // Default host: /admin and /manager are off-limits — the subdomain is the
  // only door. Redirect (not 404, so old bookmarks/links keep working),
  // stripping the now-redundant prefix so the new URL is clean.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL(pathname.slice("/admin".length) || "/", ADMIN_URL));
  }
  if (pathname === "/manager" || pathname.startsWith("/manager/")) {
    return NextResponse.redirect(new URL(pathname.slice("/manager".length) || "/", MANAGER_URL));
  }
  if (pathname.startsWith("/manager-invite/")) {
    const token = pathname.slice("/manager-invite/".length);
    return NextResponse.redirect(new URL(`/invite/${token}`, MANAGER_URL));
  }

  if (PLAYER_AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const auth = await getAuthContext(req);
    if (!auth) return redirectToLogin(req, pathname);
  }
  return NextResponse.next();
}

/**
 * admin./manager. hosts: every path is transparently rewritten into
 * `prefix`'s existing route tree (never shown in the URL bar), and every
 * path except its own /login (and, for manager, the public invite-accept
 * page) requires auth AND the matching role — see `loginUrlForRole`.
 *
 * The login target is a TOP-LEVEL page (/admin-login, /manager-login),
 * deliberately outside src/app/admin|manager/ — nesting it inside would
 * inherit that segment's own auth-redirect-to-/login layout and loop forever
 * (the login page would redirect to itself).
 */
async function handleZone(req: NextRequest, prefix: "/admin" | "/manager") {
  const pathname = req.nextUrl.pathname;
  const loginTarget = prefix === "/admin" ? "/admin-login" : "/manager-login";

  if (pathname === "/signup") {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  let target: string;
  if (pathname === "/login") {
    target = loginTarget;
  } else if (prefix === "/manager" && pathname.startsWith("/invite/")) {
    target = `/manager-invite/${pathname.slice("/invite/".length)}`;
  } else if (prefix === "/manager" && pathname.startsWith("/manager-invite/")) {
    target = pathname;
  } else if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    target = pathname;
  } else {
    target = pathname === "/" ? prefix : `${prefix}${pathname}`;
  }

  const isPublic = target === loginTarget || target.startsWith("/manager-invite/");
  if (!isPublic) {
    const auth = await getAuthContext(req);
    if (!auth) return redirectToLogin(req, pathname);

    const roleAllowed = prefix === "/admin" ? hasRole(auth.role, ROLE_HIERARCHY) : auth.role === "MANAGER";
    if (!roleAllowed) return NextResponse.redirect(loginUrlForRole(auth.role));
  }

  const url = new URL(target, req.url);
  url.search = req.nextUrl.search;
  return NextResponse.rewrite(url);
}

function redirectToLogin(req: NextRequest, callbackPathname: string) {
  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", callbackPathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
