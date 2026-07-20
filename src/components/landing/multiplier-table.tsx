"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { MULTIPLIER_ANCHORS } from "@/lib/multiplier";
import { formatMultiplier } from "@/lib/utils";

export function MultiplierTable() {
  return (
    <section id="multiplicadores" className="relative py-20 md:py-28 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="flex flex-col items-center text-center mb-14">
          <span className="text-sm font-semibold text-pink uppercase tracking-widest mb-3">
            Risco x recompensa
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Quanto mais longe, <span className="text-gradient-brand">maior o prêmio</span>
          </h2>
          <p className="text-text-secondary max-w-xl">
            A cada plataforma atravessada seu multiplicador cresce. A curva é totalmente
            configurável e verificável — sem surpresas.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
          {MULTIPLIER_ANCHORS.slice(1).map(([platforms, mult], i) => {
            const isHigh = mult >= 10;
            return (
              <motion.div
                key={platforms}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <Card
                  glow={isHigh ? "pink" : "none"}
                  className="p-4 flex flex-col items-center gap-1 text-center"
                >
                  <span className="text-xs text-text-muted">{platforms} plataformas</span>
                  <span
                    className={
                      isHigh
                        ? "text-xl font-extrabold text-gradient-brand"
                        : "text-xl font-extrabold text-white"
                    }
                  >
                    {formatMultiplier(mult)}
                  </span>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
