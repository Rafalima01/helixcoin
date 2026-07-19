"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  Wallet,
  Gamepad2,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountStats } from "@/hooks/use-profile";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, cn } from "@/lib/utils";

export function AccountStats() {
  const { data, isLoading } = useAccountStats();

  const net = centsToReais(data?.netProfit ?? 0);
  const stats = [
    { label: "Total depositado", icon: ArrowDownToLine, value: centsToReais(data?.totalDeposited ?? 0), tone: "" },
    { label: "Total retirado", icon: ArrowUpFromLine, value: centsToReais(data?.totalWithdrawn ?? 0), tone: "" },
    { label: "Cashback recebido", icon: Coins, value: centsToReais(data?.cashback ?? 0), tone: "" },
    { label: "Saldo disponível", icon: Wallet, value: centsToReais(data?.balance ?? 0), tone: "text-green" },
    { label: "Total apostado", icon: Gamepad2, value: centsToReais(data?.totalBet ?? 0), tone: "" },
    { label: "Lucro líquido", icon: TrendingUp, value: net, tone: net >= 0 ? "text-green" : "text-error" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4 flex flex-col gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-purple/15 text-purple">
            <s.icon className="size-4" />
          </span>
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className={cn("text-lg md:text-xl font-extrabold tabular-nums", s.tone)}>
              <AnimatedNumber value={s.value} format={(v) => formatCurrency(v)} />
            </p>
          )}
          <p className="text-xs text-text-secondary leading-tight">{s.label}</p>
        </Card>
      ))}
    </div>
  );
}
