"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlineCounter } from "@/components/landing/online-counter";

/**
 * Mobile-first image composition (per the approved reference): a full-screen
 * background illustration with the title art overlaid on its upper third and
 * the CTAs anchored at the bottom. There is no separate desktop layout — the
 * composition is width-capped so it simply centers on wide screens.
 */
export function Hero() {
  return (
    <section className="relative flex justify-center overflow-hidden bg-[#12081f]">
      <h1 className="sr-only">Helix Coin</h1>

      {/* Ambient glow bleeding into the empty side margins on wide viewports —
          the mobile-first composition below is intentionally width-capped, so
          without this the desktop sides read as flat dead space. Invisible on
          mobile since there's no margin to bleed into there. */}
      <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden>
        <div className="absolute left-0 top-1/4 size-[440px] -translate-x-1/2 rounded-full bg-purple/25 blur-[140px]" />
        <div className="absolute right-0 bottom-1/4 size-[440px] translate-x-1/2 rounded-full bg-gold/20 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md min-h-dvh flex flex-col">
        <Image
          src="/hero-background.png"
          alt=""
          aria-hidden
          fill
          priority
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover object-top select-none"
        />

        <div className="relative z-10 flex flex-col items-center flex-1 px-5 pt-24 pb-12">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-full bg-[#12081f]/75 backdrop-blur-sm shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
          >
            <OnlineCounter />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="w-full"
          >
            <Image
              src="/hero-title.png"
              alt="Desça as plataformas e ganhe!"
              width={1535}
              height={1024}
              priority
              className="w-[88%] max-w-sm mx-auto h-auto mt-5 select-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            />
          </motion.div>

          <div className="flex-1" />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
            className="w-full flex flex-col items-center gap-4"
          >
            <Link href="/jogada-gratis" className="w-full max-w-xs">
              <Button variant="gold" size="lg" className="w-full uppercase tracking-wide">
                Jogar grátis
              </Button>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold italic text-white/90 hover:text-white transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
            >
              Já tenho conta
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
