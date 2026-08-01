"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { HeroScene } from "@/components/landing/hero-scene-loader";

/** Official campaign banner — the real asset, not a placeholder or CSS recreation. */
export interface AuthBanner {
  src: string;
  /** Intrinsic pixel dimensions of the source asset — sets the container's aspect-ratio so the banner never crops or distorts. */
  width: number;
  height: number;
  alt: string;
}

export function AuthShell({
  children,
  title,
  subtitle,
  quote,
  banner,
  hideHero = false,
  centered = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  quote?: string;
  /** Player login/signup only — renders the official banner at the top of the centered layout. */
  banner?: AuthBanner;
  /** Drops the game hero/testimonial panel — used by the admin/manager logins, which shouldn't feel like the player app. */
  hideHero?: boolean;
  /**
   * Single centered column, no split-screen panel at all — used by the
   * player login/signup pages, which dropped the 3D hero entirely rather
   * than leaving an empty decorative half behind (see `hideHero`, which
   * still keeps the branded split panel for admin/manager logins).
   */
  centered?: boolean;
}) {
  if (centered) {
    return (
      <div className="relative min-h-dvh w-full flex flex-col items-center px-4 py-8 sm:px-6 sm:py-10 overflow-hidden">
        <div className="absolute inset-0 bg-app-radial" />
        <motion.div
          className="absolute -top-40 -left-40 size-[520px] rounded-full bg-purple/15 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-20 size-[420px] rounded-full bg-pink/15 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />

        <Link href="/" className="relative z-10 mb-4">
          <Logo className="h-7" />
        </Link>

        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[560px] mb-6 overflow-hidden rounded-[var(--radius-card)] border border-border shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
            style={{ aspectRatio: `${banner.width} / ${banner.height}` }}
          >
            <Image
              src={banner.src}
              alt={banner.alt}
              fill
              priority
              sizes="(min-width: 640px) 560px, 100vw"
              className="object-cover"
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: banner ? 0.1 : 0 }}
          className="relative z-10 w-full max-w-[420px]"
        >
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-center">{title}</h1>
          <p className="text-text-secondary mb-8 text-center">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-border">
        <div className="absolute inset-0 bg-app-radial" />
        <motion.div
          className="absolute -top-40 -left-40 size-[520px] rounded-full bg-purple/20 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-20 size-[420px] rounded-full bg-pink/20 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -right-24 size-[300px] rounded-full bg-gold/15 blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 24, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />

        <Link href="/" className="relative z-10">
          <Logo />
        </Link>

        {!hideHero && (
          <>
            <div className="relative z-10 flex items-center justify-center flex-1">
              <HeroScene className="relative aspect-square w-full max-w-[360px] mx-auto" />
            </div>

            <blockquote className="relative z-10 text-text-secondary text-lg leading-relaxed max-w-md">
              {quote ??
                "“O multiplicador mais alto que já resgatei foi 34x — o coração dispara toda vez.”"}
              <footer className="mt-3 text-sm text-text-muted">— Jogador verificado HeliJump</footer>
            </blockquote>
          </>
        )}
      </div>

      <div className="flex flex-col justify-center items-center px-6 py-12 sm:px-12 relative">
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2">
          <Link href="/">
            <Logo />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-[420px] mt-16 lg:mt-0"
        >
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">{title}</h1>
          <p className="text-text-secondary mb-8">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
