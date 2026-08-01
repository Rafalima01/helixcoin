"use client";

import { useRouter } from "next/navigation";
import { Play, Target, Wallet as WalletIcon, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetStore } from "@/store/bet-store";
import { useWallet } from "@/hooks/use-wallet";
import { useGameConfig } from "@/hooks/use-game-config";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, formatMultiplier, cn } from "@/lib/utils";

export function BetPanel() {
  const router = useRouter();
  const { amount, setAmount } = useBetStore();
  const { data } = useWallet();
  const { data: config, isLoading: configLoading } = useGameConfig();
  const balance = centsToReais(data?.balance ?? 0);

  // Quick-bet buttons, min/max, and the goal multiplier are all defined by
  // the platform (backend/admin) — the frontend only reads and renders them.
  const targetMultiplier = config?.targetMultiplier ?? null;
  const goalValue = targetMultiplier ? amount * targetMultiplier : null;
  const quickAmounts = config?.quickBetAmounts ?? [];

  const handlePlay = () => {
    if (amount <= 0) {
      toast.error("Escolha um valor de aposta");
      return;
    }
    if (config && amount < config.betMin) {
      toast.error(`Valor mínimo de aposta: ${formatCurrency(config.betMin)}`);
      return;
    }
    if (config && amount > config.betMax) {
      toast.error(`Valor máximo de aposta: ${formatCurrency(config.betMax)}`);
      return;
    }
    if (amount > balance) {
      toast.error("Saldo insuficiente. Deposite para continuar.");
      return;
    }
    router.push("/play");
  };

  return (
    <Card glow="purple" className="p-6 md:p-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-purple/15 border border-purple/25">
          <WalletIcon className="size-4 text-purple" />
        </div>
        <div>
          <h2 className="font-bold text-lg leading-none">Nova Partida</h2>
          <p className="text-xs text-text-muted mt-1">Escolha o valor e gire a torre</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <label className="text-sm font-medium text-text-secondary">Valor da aposta</label>
        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={cn(
                "h-12 rounded-xl border text-sm font-bold transition-all",
                amount === v
                  ? "border-purple bg-purple/15 text-purple glow-purple"
                  : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong"
              )}
            >
              R${v % 1 === 0 ? v : v.toFixed(2)}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">
            R$
          </span>
          <input
            type="number"
            min={1}
            step="0.5"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full h-12 rounded-xl bg-white/[0.03] border border-border pl-10 pr-4 text-[15px] font-bold outline-none focus:border-purple/60 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)] transition-all"
          />
        </div>
      </div>

      {/* Platform-defined goal — read-only */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-white/[0.02] p-4 flex flex-col gap-1">
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Target className="size-3" /> Meta da plataforma
            <Lock className="size-2.5 opacity-60" />
          </span>
          {configLoading || targetMultiplier === null ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className="text-xl font-extrabold text-gradient-brand">
              {formatMultiplier(targetMultiplier)}
            </span>
          )}
        </div>
        <div className="rounded-xl border border-border bg-white/[0.02] p-4 flex flex-col gap-1">
          <span className="text-xs text-text-muted">Objetivo da partida</span>
          {goalValue === null ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <span className="text-xl font-extrabold text-gradient-green">
              <AnimatedNumber value={goalValue} format={(v) => formatCurrency(v)} />
            </span>
          )}
        </div>
      </div>

      <Button variant="arcade" size="lg" onClick={handlePlay} className="w-full text-base uppercase">
        <Play className="size-5" fill="currentColor" />
        Jogar Agora
      </Button>
    </Card>
  );
}
