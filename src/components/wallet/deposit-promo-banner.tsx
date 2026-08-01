"use client";

import { Flame } from "lucide-react";
import { useDepositPromoCountdown } from "@/hooks/use-deposit-promo-countdown";

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Discreet-but-visible countdown trigger. No close/dismiss control by
 * design — the requirement is explicit that the timer must never be
 * cancelled or made to disappear mid-session, only ever expire naturally
 * (see useDepositPromoCountdown's doc comment for the exact persistence rule).
 */
export function DepositPromoBanner({ durationSeconds }: { durationSeconds: number }) {
  const { secondsLeft, expired } = useDepositPromoCountdown(durationSeconds);

  if (expired) return null;

  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2">
      <Flame className="size-4 text-danger shrink-0" />
      <span className="text-xs font-semibold text-text-secondary">Bônus expira em</span>
      <span className="font-display text-sm font-bold tabular-nums text-white">{formatClock(secondsLeft)}</span>
    </div>
  );
}
