"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative glass-card p-10 md:p-16 text-center overflow-hidden glow-purple"
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, rgba(139,92,246,0.25) 0%, transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5">
              Pronto para <span className="text-gradient-brand">girar a torre?</span>
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto mb-9">
              Crie sua conta em menos de um minuto e faça sua primeira jogada hoje mesmo.
            </p>
            <Link href="/signup">
              <Button variant="primary" size="lg">
                Criar Conta Grátis
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
