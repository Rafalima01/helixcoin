"use client";

import {
  ArrowLineDownIcon as ArrowDownToLine,
  ArrowLineUpIcon as ArrowUpFromLine,
  CoinsIcon as Coins,
  WalletIcon as Wallet,
  GameControllerIcon as Gamepad2,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountStats } from "@/hooks/use-profile";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, cn } from "@/lib/utils";

export function AccountStats() {
  const { data, isLoading } = useAccountStats();

  const secondary = [
    {
      label: "Total depositado",
      icon: ArrowDownToLine,
      value: centsToReais(data?.totalDeposited ?? 0),
    },
    {
      label: "Total retirado",
      icon: ArrowUpFromLine,
      value: centsToReais(data?.totalWithdrawn ?? 0),
    },
    { label: "Cashback recebido", icon: Coins, value: centsToReais(data?.cashback ?? 0) },
    { label: "Total apostado", icon: Gamepad2, value: centsToReais(data?.totalBet ?? 0) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Hero — the one number that actually matters at a glance */}
      <Card variant="hero-number" className="flex flex-col gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Wallet className="size-5" weight="duotone" />
        </span>
        {isLoading ? (
          <Skeleton className="h-9 w-36" />
        ) : (
          <p className="font-display text-3xl md:text-4xl font-extrabold text-gradient-gold tabular-nums">
            <AnimatedNumber value={centsToReais(data?.balance ?? 0)} format={(v) => formatCurrency(v)} />
          </p>
        )}
        <p className="text-sm text-text-secondary">Saldo disponível</p>
      </Card>

      {/* Secondary — grouped as a list, not a grid of identical boxes */}
      <div className="flex flex-col gap-2">
        {secondary.map((s) => (
          <Card key={s.label} variant="list-row" className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple/15 text-purple">
              <s.icon className="size-4" weight="duotone" />
            </span>
            <p className="flex-1 text-sm text-text-secondary min-w-0 truncate">{s.label}</p>
            {isLoading ? (
              <Skeleton className="h-5 w-16 shrink-0" />
            ) : (
              <p className={cn("text-sm font-bold tabular-nums shrink-0", s.label === "Total retirado" && "text-pink")}>
                {formatCurrency(s.value)}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
