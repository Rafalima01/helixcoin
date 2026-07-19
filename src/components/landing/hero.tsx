"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnlineCounter } from "@/components/landing/online-counter";
import { HeroTower } from "@/components/landing/hero-tower";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8 grid md:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="mb-6">
            <OnlineCounter />
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.02] mb-6">
            <span className="text-white">Gire e</span>{" "}
            <span className="text-gradient-brand">Ganhe</span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary max-w-xl mb-9 leading-relaxed">
            O skill game mais viciante do Brasil. Controle a torre, atravesse
            plataformas e multiplique seu saldo com puro timing e reflexo —
            sem sorte, sem cartas, sem roleta.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/signup">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                <Play className="size-5" fill="currentColor" />
                Jogar Agora
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Criar Conta
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-6 text-sm text-text-muted">
            <span>Saques via PIX</span>
            <span className="size-1 rounded-full bg-text-muted/40" />
            <span>100% habilidade</span>
            <span className="size-1 rounded-full bg-text-muted/40" />
            <span>Sem cadastro de cartão</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="animate-float"
        >
          <HeroTower />
        </motion.div>
      </div>
    </section>
  );
}
