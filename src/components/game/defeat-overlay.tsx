"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { SkullIcon, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency } from "@/lib/utils";

export function DefeatOverlay({ onTryAgain }: { onTryAgain: () => void }) {
  const { betAmountCents, platformsPassed } = useGameStore();
  const lost = centsToReais(betAmountCents);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card max-w-md w-full p-8 flex flex-col items-center text-center border-error/30"
      >
        <motion.div
          initial={{ scale: 0.7, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
          className="flex size-20 items-center justify-center rounded-full bg-error/15 border border-error/30 mb-5"
        >
          <SkullIcon className="size-10 text-error" />
        </motion.div>

        <p className="text-sm font-semibold text-error uppercase tracking-widest mb-2">
          Fim de jogo
        </p>
        <p className="text-5xl font-extrabold text-error mb-3 tabular-nums">
          -{formatCurrency(lost)}
        </p>
        <p className="text-sm text-text-secondary mb-8">
          Você atravessou {platformsPassed} plataformas antes de cair. Tente de novo e resgate
          antes do buraco te pegar.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link href="/home" className="flex-1">
            <Button variant="secondary" size="lg" className="w-full">
              <Home className="size-4" />
              Início
            </Button>
          </Link>
          <Button variant="primary" size="lg" onClick={onTryAgain} className="flex-1">
            <RotateCcw className="size-4" />
            Tentar Novamente
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
