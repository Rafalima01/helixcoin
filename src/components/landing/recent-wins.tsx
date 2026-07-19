"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LIVE_WINS } from "@/lib/landing-data";
import { formatCurrency, formatMultiplier } from "@/lib/utils";

export function RecentWins() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="flex flex-col items-center text-center mb-14">
          <span className="text-sm font-semibold text-pink uppercase tracking-widest mb-3">
            Ao vivo
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Pessoas reais, <span className="text-gradient-brand">ganhos reais</span>
          </h2>
          <p className="text-text-secondary max-w-xl">
            Cada card abaixo representa uma partida resgatada com sucesso nos
            últimos minutos.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {LIVE_WINS.slice(0, 8).map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.08 }}
            >
              <Card hoverLift className="p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-purple to-pink text-sm font-bold">
                    {w.name.charAt(0)}
                  </div>
                  <div className="flex items-center gap-1 text-green text-xs font-bold">
                    <TrendingUp className="size-3.5" />
                    {formatMultiplier(w.multiplier)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted">{w.name} · {w.city}</p>
                  <p className="text-xl font-extrabold text-gradient-green mt-0.5">
                    {formatCurrency(w.amount)}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
