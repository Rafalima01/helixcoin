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
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
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
      <body className="min-h-full flex flex-col bg-app-radial text-text relative">
        <div className="noise-overlay" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
