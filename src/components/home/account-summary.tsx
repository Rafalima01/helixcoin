"use client";

import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useGameConfig } from "@/hooks/use-game-config";
import { useWallet } from "@/hooks/use-wallet";
import { formatMultiplier } from "@/lib/utils";

/** Compact account overview for the home screen: current goal + level progress. */
export function AccountSummary() {
  const { data: config } = useGameConfig();
  const { data: wallet } = useWallet();

  const xp = wallet?.user?.xp ?? 0;
  const level = wallet?.user?.level ?? 1;
  const levelProgress = (xp % 1000) / 1000;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-bold text-lg">Resumo da conta</h3>
        <span className="flex items-center gap-1.5 rounded-full border border-purple/30 bg-purple/10 px-3 py-1 text-[11px] font-bold text-purple">
          <Target className="size-3" />
          Meta atual {config ? formatMultiplier(config.targetMultiplier) : "—"}
        </span>
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
