"use client";

import Link from "next/link";
import { Plus, ArrowUpRight, Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { centsToReais } from "@/lib/multiplier";

export function BalanceCard() {
  const { data, isLoading } = useWallet();
  const balance = centsToReais(data?.balance ?? 0);

  return (
    <Card className="p-6 md:p-8 relative overflow-hidden">
      <div
        className="absolute -top-24 -right-24 size-64 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(22,242,165,0.35), transparent 70%)" }}
      />
      <div className="relative">
        <p className="text-sm text-text-secondary mb-2">Saldo disponível</p>
        {isLoading ? (
          <Skeleton className="h-10 w-40 mb-6" />
        ) : (
          <p className="text-4xl md:text-5xl font-extrabold text-gradient-green mb-6 tabular-nums">
            R$ <AnimatedNumber value={balance} />
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href="/deposit">
            <Button variant="primary" size="md">
              <Plus className="size-4" />
              Depositar
            </Button>
          </Link>
          <Link href="/withdraw">
            <Button variant="secondary" size="md">
              <ArrowUpRight className="size-4" />
              Sacar
            </Button>
          </Link>
          <Link href="/referrals">
            <Button variant="outline" size="md">
              <Gift className="size-4" />
              Indicar
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
