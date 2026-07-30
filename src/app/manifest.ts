import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * A single `manifest.ts` serves every zone — same reasoning as
 * `src/app/robots.ts`: `src/proxy.ts`'s matcher excludes any path with a dot
 * from its host-based rewrite, so `/manifest.webmanifest` always resolves
 * here regardless of subdomain. Reading the real `Host` header (a
 * request-time API, opts this route out of static caching — see the
 * Next.js docs' "Good to know" on `manifest.js`) is what lets each zone get
 * a `start_url` that actually resolves on that host: `/home` only exists
 * under the player app, so admin./manager. need their own `start_url: "/"`,
 * which `src/proxy.ts`'s `handleZone` rewrites to `/admin`/`/manager` (the
 * real dashboard) — using the player's `/home` there 404s, since
 * `handleZone` prefixes every non-root path with the zone prefix and
 * neither `/admin/home` nor `/manager/home` exists.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get("host") ?? "";

  const icons: MetadataRoute.Manifest["icons"] = [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];

  const shared = {
    display: "standalone" as const,
    background_color: "#0B0815",
    theme_color: "#0B0815",
    icons,
  };

  if (host.startsWith("admin.")) {
    return {
      ...shared,
      id: "/admin",
      name: "HeliJump Admin",
      short_name: "HJ Admin",
      description: "Backoffice HeliJump — gestão, pagamentos, RTP e notificações.",
      start_url: "/",
    };
  }

  if (host.startsWith("manager.")) {
    return {
      ...shared,
      id: "/manager",
      name: "HeliJump Gerente",
      short_name: "HJ Gerente",
      description: "Portal do Gerente HeliJump — rede, comissões e notificações.",
      start_url: "/",
    };
  }

  return {
    ...shared,
    id: "/home",
    name: "HeliJump — Gire e Ganhe",
    short_name: "HeliJump",
    description:
      "A plataforma de skill game mais premium do Brasil. Controle a torre, atravesse plataformas e multiplique seu saldo com habilidade e timing.",
    start_url: "/home",
  };
}
