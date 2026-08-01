"use client";

import { Zap } from "lucide-react";
import { LIVE_WINS } from "@/lib/landing-data";
import { cn, formatCurrency, formatMultiplier } from "@/lib/utils";

/** `compact` shrinks this into a discreet activity indicator (used on the player Home) — the landing page keeps the full-size version. */
export function LiveTicker({ compact = false }: { compact?: boolean }) {
  const items = [...LIVE_WINS, ...LIVE_WINS];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden border-y border-border glass-panel",
        compact ? "py-1.5" : "py-3"
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent z-10" />
      <div className={cn("flex w-max animate-marquee", compact ? "gap-2" : "gap-4")}>
        {items.map((w, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] whitespace-nowrap",
              compact ? "px-2.5 py-0.5" : "px-4 py-1.5"
            )}
          >
            <Zap className={cn("text-green shrink-0", compact ? "size-2.5" : "size-3.5")} />
            <span className={cn("font-medium text-text-secondary", compact ? "text-[11px]" : "text-sm")}>
              {w.name} <span className="text-text-muted">de {w.city}</span> ganhou{" "}
              <span className="font-bold text-green">{formatCurrency(w.amount)}</span>{" "}
              <span className={cn("text-purple font-semibold", compact ? "text-[10px]" : "text-xs")}>
                ({formatMultiplier(w.multiplier)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
