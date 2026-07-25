import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { PLAYER_URL } from "@/config/domains";

/**
 * A single `robots.ts` serves every zone — `src/proxy.ts`'s matcher
 * excludes any path with a dot (`.*\..*`) from its host-based rewrite, so
 * `/robots.txt` always resolves to this one file regardless of which
 * subdomain the request came in on. Reading the real `Host` header via
 * `headers()` (a request-time API, so this route opts out of static
 * caching — see the Next.js docs' "Good to know" on `robots.js`) is what
 * lets it still answer differently per zone: admin./manager. always get a
 * blanket disallow (defense-in-depth alongside each zone's own
 * `robots: { index: false, follow: false }` page metadata — see
 * src/app/admin/layout.tsx / src/app/manager/layout.tsx), the player zone
 * allows its public marketing/auth pages and disallows everything that
 * requires a logged-in session.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";

  if (host.startsWith("admin.") || host.startsWith("manager.")) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/docs",
        "/home",
        "/play",
        "/wallet",
        "/profile",
        "/deposit",
        "/withdraw",
        "/referrals",
      ],
    },
    sitemap: new URL("/sitemap.xml", PLAYER_URL).toString(),
  };
}
