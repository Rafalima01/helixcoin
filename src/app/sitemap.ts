import type { MetadataRoute } from "next";
import { PLAYER_URL } from "@/config/domains";

/**
 * Only the player zone's public (unauthenticated) pages — everything behind
 * login (see robots.ts's disallow list) isn't worth indexing, and admin./
 * manager. are excluded from search entirely (`robots: { index: false }` on
 * their layouts). This file is served identically regardless of host (see
 * robots.ts's comment on `src/proxy.ts`'s matcher), but only the player
 * zone's robots.txt links to it, so that's a non-issue in practice.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: PLAYER_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/login", PLAYER_URL).toString(), lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: new URL("/signup", PLAYER_URL).toString(), lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
