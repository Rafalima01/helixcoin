"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Wallet, Target, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useGameStore } from "@/store/game-store";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, formatMultiplier, cn } from "@/lib/utils";

/**
 * Minimal match HUD. Contains ONLY: bet amount, current multiplier, current
 * value, read-only goal, goal progress bar, goal state indicator and the
 * cashout button — which stays LOCKED until the admin-defined goal is reached
 * (the server enforces the same rule; this is just the visual layer).
 */
export function GameHud({
  onCashout,
  cashoutLoading,
}: {
  onCashout: () => void;
  cashoutLoading: boolean;
}) {
  const status = useGameStore((s) => s.status);
  const multiplier = useGameStore((s) => s.multiplier);
  const betAmountCents = useGameStore((s) => s.betAmountCents);
  const targetMultiplier = useGameStore((s) => s.targetMultiplier);
  const goalAmountCents = useGameStore((s) => s.goalAmountCents);
  const goalReached = useGameStore((s) => s.goalReached);

  const betReais = centsToReais(betAmountCents);
  const currentValue = betReais * multiplier;
  const goalValue =
    goalAmountCents > 0 ? centsToReais(goalAmountCents) : betReais * targetMultiplier;
  const progress =
    targetMultiplier > 1
      ? Math.min(1, Math.max(0, (multiplier - 1) / (targetMultiplier - 1)))
      : 0;
  const isPlaying = status === "playing";
  const canCashout = isPlaying && goalReached;

  // Haptic feedback the moment the goal unlocks (mobile).
  const prevGoal = useRef(false);
  useEffect(() => {
    if (goalReached && !prevGoal.current && typeof navigator !== "undefined") {
      navigator.vibrate?.([80, 40, 160]);
    }
    prevGoal.current = goalReached;
  }, [goalReached]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-4 md:p-6 z-10">
      {/* Current multiplier + always-visible goal state */}
      <div className="flex flex-col items-center gap-2">
        <div className="glass-card px-6 py-3 flex flex-col items-center glow-purple">
          <span className="text-xs text-text-muted flex items-center gap-1">
            <TrendingUp className="size-3" /> Multiplicador
          </span>
          <span className="text-3xl md:text-4xl font-extrabold text-gradient-brand tabular-nums">
            <AnimatedNumber value={multiplier} format={formatMultiplier} duration={0.3} />
          </span>
        </div>

        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-md transition-colors duration-500",
            goalReached
              ? "border-green/50 bg-green/15 text-green"
              : "border-border bg-black/40 text-text-secondary"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              goalReached ? "bg-green shadow-[0_0_8px_rgba(22,242,165,0.9)]" : "bg-text-muted/50"
            )}
          />
          {goalReached ? (
            <>
              <Unlock className="size-3" /> Resgate liberado
            </>
          ) : (
            <>
              <Lock className="size-3" /> Meta não atingida
            </>
          )}
        </span>
      </div>

      <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-3">
        {/* Bet / current value / goal */}
        <div className="flex w-full gap-2">
          <div className="flex-1 glass-card px-3 py-2.5 flex flex-col items-center">
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Wallet className="size-3" /> Apostado
            </span>
            <span className="font-bold text-[15px] tabular-nums">{formatCurrency(betReais)}</span>
          </div>
          <div className="flex-1 glass-card px-3 py-2.5 flex flex-col items-center">
            <span className="text-[11px] text-text-muted">Valor atual</span>
            <span className="font-bold text-[15px] text-green tabular-nums">
              <AnimatedNumber value={currentValue} format={(v) => formatCurrency(v)} duration={0.3} />
            </span>
          </div>
          <div className="flex-1 glass-card px-3 py-2.5 flex flex-col items-center">
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Target className="size-3" /> Meta {formatMultiplier(targetMultiplier)}
            </span>
            <span className="font-bold text-[15px] tabular-nums">{formatCurrency(goalValue)}</span>
          </div>
        </div>

        {/* Goal progress */}
        <div
          className={cn(
            "w-full rounded-2xl border px-4 py-3 backdrop-blur-md transition-all duration-500",
            goalReached
              ? "border-green/50 bg-green/10 shadow-[0_0_28px_rgba(22,242,165,0.25)]"
              : "border-border bg-black/40"
          )}
        >
          <div className="mb-2 flex items-center justify-between text-[11px]">
            {goalReached ? (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 font-bold text-green"
              >
                <Unlock className="size-3.5" />
                Meta atingida! Você já pode resgatar.
              </motion.span>
            ) : (
              <span className="text-text-muted flex items-center gap-1.5">
                <Lock className="size-3" />
                Progresso da meta
              </span>
            )}
            <span className={cn("font-bold tabular-nums", goalReached ? "text-green" : "text-text-secondary")}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                goalReached
                  ? "bg-green shadow-[0_0_16px_rgba(22,242,165,0.7)]"
                  : "bg-gradient-to-r from-purple via-pink to-green"
              )}
              animate={{
                width: `${progress * 100}%`,
                ...(goalReached ? { opacity: [1, 0.75, 1] } : {}),
              }}
              transition={{
                width: { type: "spring", stiffness: 120, damping: 22 },
                ...(goalReached ? { opacity: { duration: 1.1, repeat: Infinity } } : {}),
              }}
            />
          </div>
        </div>

        {/* Cashout — locked until the goal is reached */}
        <div
          className="w-full"
          title={
            isPlaying && !goalReached ? "Atinja a meta para liberar o resgate." : undefined
          }
        >
          <Button
            variant={canCashout ? "success" : "secondary"}
            size="lg"
            onClick={onCashout}
            loading={cashoutLoading}
            disabled={!canCashout}
            aria-disabled={!canCashout}
            className={cn(
              "w-full text-base transition-all duration-500",
              canCashout
                ? "shadow-[0_0_32px_rgba(22,242,165,0.45)] bg-gradient-to-r from-green to-emerald-400 text-[#05261c]"
                : "opacity-60 cursor-not-allowed border border-border"
            )}
          >
            {canCashout ? (
              <Unlock className="size-4" />
            ) : (
              <Lock className="size-4" />
            )}
            Resgatar {formatCurrency(currentValue)}
          </Button>
        </div>
      </div>
    </div>
  );
}
