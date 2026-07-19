"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Trophy, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useGameStore } from "@/store/game-store";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, formatMultiplier } from "@/lib/utils";

export function VictoryOverlay({ onPlayAgain }: { onPlayAgain: () => void }) {
  const { payoutCents, multiplier, platformsPassed, betAmountCents } = useGameStore();
  const payout = centsToReais(payoutCents);
  const profit = payout - centsToReais(betAmountCents);
  const xp = platformsPassed * 12;

  useEffect(() => {
    const colors = ["#8B5CF6", "#FF4FAE", "#16F2A5"];
    const duration = 1800;
    const end = Date.now() + duration;

    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card glow-green max-w-md w-full p-8 flex flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-green to-emerald-400 mb-5 glow-green"
        >
          <Trophy className="size-10 text-[#05261c]" />
        </motion.div>

        <p className="text-sm font-semibold text-green uppercase tracking-widest mb-2">
          Resgate confirmado
        </p>
        <p className="text-5xl font-extrabold text-gradient-green mb-3 tabular-nums">
          <AnimatedNumber value={payout} format={(v) => formatCurrency(v)} duration={1} />
        </p>

        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm text-text-secondary">
            Multiplicador <span className="font-bold text-white">{formatMultiplier(multiplier)}</span>
          </span>
          <span className="size-1 rounded-full bg-text-muted/40" />
          <span className="text-sm text-text-secondary">
            Lucro <span className="font-bold text-green">+{formatCurrency(profit)}</span>
          </span>
        </div>

        <div className="w-full rounded-xl border border-border bg-white/[0.03] px-4 py-3 flex items-center justify-between mb-8">
          <span className="text-sm text-text-secondary">XP ganho</span>
          <span className="font-bold text-purple">+{xp} XP</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link href="/home" className="flex-1">
            <Button variant="secondary" size="lg" className="w-full">
              <Home className="size-4" />
              Início
            </Button>
          </Link>
          <Button variant="primary" size="lg" onClick={onPlayAgain} className="flex-1">
            <RotateCcw className="size-4" />
            Jogar Novamente
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
