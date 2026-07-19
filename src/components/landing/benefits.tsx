"use client";

import { motion } from "framer-motion";
import { Gauge, Zap, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BENEFITS } from "@/lib/landing-data";

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  zap: Zap,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
};

export function Benefits() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col items-center text-center mb-14">
          <span className="text-sm font-semibold text-purple uppercase tracking-widest mb-3">
            Por que HeliJump
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Construído para quem <span className="text-gradient-brand">joga a sério</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {BENEFITS.map((b, i) => {
            const Icon = ICONS[b.icon];
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
              >
                <Card hoverLift className="h-full flex flex-col gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple/20 to-pink/20 border border-purple/20">
                    <Icon className="size-6 text-purple" />
                  </div>
                  <h3 className="text-lg font-bold">{b.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {b.description}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
