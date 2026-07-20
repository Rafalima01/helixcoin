import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";

/**
 * Proxy defaults to the Node.js runtime in this Next.js version (middleware
 * is deprecated/renamed — see node_modules/next/dist/docs/.../proxy.md), so
 * this can use the full `getAuthContext` (ioredis blacklist check included)
 * directly instead of a separate Edge-safe jose-only path.
 */
export default async function proxy(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/play/:path*", "/wallet/:path*", "/profile/:path*"],
};
