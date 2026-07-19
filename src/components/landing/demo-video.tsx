"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

export function DemoVideo() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="flex flex-col items-center text-center mb-12">
          <span className="text-sm font-semibold text-green uppercase tracking-widest mb-3">
            Veja em ação
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Gameplay <span className="text-gradient-brand">real</span>
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="relative rounded-[28px] overflow-hidden glass-card aspect-video group"
        >
          <div className="absolute inset-0 bg-app-radial" />
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-30">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-full border-2 border-dashed border-purple animate-spin-slow"
                style={{ width: 120 + i * 80, height: 120 + i * 80, position: "absolute" }}
              />
            ))}
          </div>

          <Link
            href="/signup"
            className="relative z-10 flex size-20 md:size-24 items-center justify-center rounded-full bg-gradient-to-br from-purple to-pink shadow-[0_0_60px_rgba(139,92,246,0.6)] transition-transform group-hover:scale-110"
            aria-label="Jogar demonstração"
          >
            <Play className="size-8 md:size-10 text-white translate-x-0.5" fill="currentColor" />
          </Link>

          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-sm text-text-secondary">
            <span>Torre 3D · Física em tempo real · 60 FPS</span>
            <span className="hidden sm:inline">Clique para jogar</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
