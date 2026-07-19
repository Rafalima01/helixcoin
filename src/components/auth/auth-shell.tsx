"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { HeroTower } from "@/components/landing/hero-tower";

export function AuthShell({
  children,
  title,
  subtitle,
  quote,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  quote?: string;
}) {
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

        <Link href="/" className="relative z-10">
          <Logo />
        </Link>

        <div className="relative z-10 flex items-center justify-center flex-1">
          <HeroTower />
        </div>

        <blockquote className="relative z-10 text-text-secondary text-lg leading-relaxed max-w-md">
          {quote ?? "“O multiplicador mais alto que já resgatei foi 34x — o coração dispara toda vez.”"}
          <footer className="mt-3 text-sm text-text-muted">— Jogador verificado HeliJump</footer>
        </blockquote>
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
