"use client";

import { Target, Gamepad2, TrendingUp, ArrowDownToLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountStats } from "@/hooks/use-profile";
import { useGameConfig } from "@/hooks/use-game-config";
import { useWallet } from "@/hooks/use-wallet";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, formatMultiplier, cn } from "@/lib/utils";

/** Compact account overview for the home screen: key numbers + current goal. */
export function AccountSummary() {
  const { data: stats, isLoading } = useAccountStats();
  const { data: config } = useGameConfig();
  const { data: wallet } = useWallet();

  const net = centsToReais(stats?.netProfit ?? 0);
  const xp = wallet?.user?.xp ?? 0;
  const level = wallet?.user?.level ?? 1;
  const levelProgress = (xp % 1000) / 1000;

  const items = [
    { label: "Total depositado", icon: ArrowDownToLine, value: centsToReais(stats?.totalDeposited ?? 0), tone: "" },
    { label: "Total apostado", icon: Gamepad2, value: centsToReais(stats?.totalBet ?? 0), tone: "" },
    { label: "Lucro líquido", icon: TrendingUp, value: net, tone: net >= 0 ? "text-green" : "text-error" },
  ];

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-lg">Resumo da conta</h3>
        <span className="flex items-center gap-1.5 rounded-full border border-purple/30 bg-purple/10 px-3 py-1 text-[11px] font-bold text-purple">
          <Target className="size-3" />
          Meta atual{" "}
          {config ? formatMultiplier(config.targetMultiplier) : "—"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {items.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-white/[0.02] p-3 min-w-0 flex sm:flex-col items-center sm:items-start justify-between gap-1"
          >
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <s.icon className="size-3 shrink-0" />
              {s.label}
            </span>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className={cn("text-sm md:text-base font-extrabold tabular-nums", s.tone)}>
                <AnimatedNumber value={s.value} format={(v) => formatCurrency(v)} />
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted mb-1.5">
        <span>Nível {level}</span>
        <span className="tabular-nums">{xp % 1000}/1000 XP</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple to-pink transition-all duration-700"
          style={{ width: `${Math.min(100, levelProgress * 100)}%` }}
        />
      </div>
    </Card>
  );
}
