"use client";

import { Zap } from "lucide-react";
import { LIVE_WINS } from "@/lib/landing-data";
import { formatCurrency, formatMultiplier } from "@/lib/utils";

export function LiveTicker() {
  const items = [...LIVE_WINS, ...LIVE_WINS];

  return (
    <div className="relative w-full overflow-hidden border-y border-border py-3 glass-panel">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent z-10" />
      <div className="flex w-max animate-marquee gap-4">
        {items.map((w, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-4 py-1.5 whitespace-nowrap"
          >
            <Zap className="size-3.5 text-green shrink-0" />
            <span className="text-sm font-medium text-text-secondary">
              {w.name} <span className="text-text-muted">de {w.city}</span> ganhou{" "}
              <span className="font-bold text-green">{formatCurrency(w.amount)}</span>{" "}
              <span className="text-xs text-purple font-semibold">
                ({formatMultiplier(w.multiplier)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
