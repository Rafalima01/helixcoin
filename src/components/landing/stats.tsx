"use client";

import { useInView } from "framer-motion";
import { useRef } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { STATS } from "@/lib/landing-data";

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="relative py-16 md:py-20 border-y border-border glass-panel">
      <div ref={ref} className="mx-auto max-w-7xl px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col items-center text-center">
            <p className="text-3xl md:text-5xl font-extrabold text-gradient-brand tabular-nums">
              {s.prefix}
              <AnimatedNumber
                value={inView ? s.value : 0}
                duration={1.6}
                format={(v) =>
                  s.decimals
                    ? v.toFixed(s.decimals)
                    : Math.round(v).toLocaleString("pt-BR")
                }
              />
              {s.suffix}
            </p>
            <p className="mt-2 text-sm text-text-secondary">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
