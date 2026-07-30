import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { PLAYER_URL } from "@/config/domains";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const title = "HeliJump — Gire e Ganhe";
const description =
  "A plataforma de skill game mais premium do Brasil. Controle a torre, atravesse plataformas e multiplique seu saldo com habilidade e timing.";

export const metadata: Metadata = {
  // Base for every relative URL below (openGraph.url, canonical, twitter
  // images) — see AGENTS.md "Fase Deploy" (SEO). Only the player zone gets
  // full SEO metadata; admin./manager. set their own `robots: { index:
  // false }` in their layouts instead (src/app/admin/layout.tsx,
  // src/app/manager/layout.tsx).
  metadataBase: new URL(PLAYER_URL),
  title,
  description,
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  // Makes iOS open the installed Home Screen web app truly full-screen (no
  // Safari chrome) instead of just honoring the manifest's `display:
  // standalone`, which older iOS doesn't always fully respect on its own —
  // see src/app/manifest.ts for the per-zone `start_url` this pairs with.
  // NOTE: this Next.js version's `appleWebApp.capable` only emits the
  // unprefixed `<meta name="mobile-web-app-capable">` (confirmed by reading
  // node_modules/next/dist/lib/metadata/metadata.js — no `apple-` prefixed
  // tag exists in its output at all), which iOS Safari has only recognized
  // since 17.4. The legacy `apple-mobile-web-app-capable` tag (supported
  // since iOS 2.1) has no Metadata API field in this version, so it's added
  // manually below via a raw `<head>` element to cover iOS 16.4–17.3 too.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "HeliJump",
    title,
    description,
    images: [{ url: "/logo-full.png", alt: "HeliJump" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/logo-full.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0815",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* See the `appleWebApp` comment above — this version's Metadata API has no field for it. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col bg-app-radial text-text relative">
        <div className="noise-overlay" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
