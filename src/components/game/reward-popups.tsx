"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency } from "@/lib/utils";

/** Matches the animation's own transition duration — see RewardPopup's `transition`. */
const REWARD_POPUP_DURATION_MS = 900;

function RewardPopup({ amountCents, onDone }: { amountCents: number; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, REWARD_POPUP_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.7 }}
      animate={{ opacity: 1, y: -22, scale: 1 }}
      exit={{ opacity: 0, y: -38, scale: 0.85 }}
      transition={{ duration: REWARD_POPUP_DURATION_MS / 1000, ease: "easeOut" }}
      className="glass-card glow-gold flex items-center gap-1.5 rounded-full px-3 py-1"
    >
      <span className="text-base leading-none">🪙</span>
      <span className="text-gradient-gold text-sm font-extrabold tabular-nums">
        +{formatCurrency(centsToReais(amountCents))}
      </span>
    </motion.div>
  );
}

/** Short, discreet "🪙 +R$X" feedback — one popup per platform consumed, mounted inside GameHud so both real and demo matches get it for free. Never touches Wallet/Ledger/payout: the value is display-only (see game-store.ts's registerPass). */
export function RewardPopups() {
  const rewardEvents = useGameStore((s) => s.rewardEvents);
  const dismissReward = useGameStore((s) => s.dismissReward);

  if (rewardEvents.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 md:top-28 z-20 flex flex-col items-center gap-1.5">
      <AnimatePresence>
        {rewardEvents.map((r) => (
          <RewardPopup key={r.id} amountCents={r.amountCents} onDone={() => dismissReward(r.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
