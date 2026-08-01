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
  const { payoutCents, multiplier, betAmountCents } = useGameStore();
  const payout = centsToReais(payoutCents);
  const bet = centsToReais(betAmountCents);

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
        className="glass-card max-w-md w-full p-8 flex flex-col items-center text-center border-green/25 shadow-[0_0_40px_-8px_rgba(22,242,165,0.35),0_24px_60px_rgba(0,0,0,0.5)]"
      >
        <motion.div
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-green to-emerald-400 mb-5 ring-2 ring-gold/40 glow-green"
        >
          <Trophy className="size-10 text-[#05261c]" />
        </motion.div>

        <p className="text-sm font-semibold text-green uppercase tracking-widest mb-2">
          Resgate confirmado
        </p>
        <p className="text-xs text-text-secondary mb-1">Valor ganho</p>
        <p className="font-display text-5xl font-extrabold text-gradient-green mb-5 tabular-nums">
          <AnimatedNumber value={payout} format={(v) => formatCurrency(v)} duration={1} />
        </p>

        <div className="grid grid-cols-2 gap-3 w-full mb-8">
          <div className="rounded-xl border border-border bg-white/[0.03] px-4 py-3 flex flex-col gap-0.5">
            <span className="text-xs text-text-muted">Multiplicador alcançado</span>
            <span className="font-display font-bold text-gold">{formatMultiplier(multiplier)}</span>
          </div>
          <div className="rounded-xl border border-border bg-white/[0.03] px-4 py-3 flex flex-col gap-0.5">
            <span className="text-xs text-text-muted">Valor apostado</span>
            <span className="font-bold text-white">{formatCurrency(bet)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link href="/home" className="flex-1">
            <Button variant="secondary" size="lg" className="w-full">
              <Home className="size-4" />
              Início
            </Button>
          </Link>
          <Button variant="gold" size="lg" onClick={onPlayAgain} className="flex-1">
            <RotateCcw className="size-4" />
            Jogar Novamente
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
