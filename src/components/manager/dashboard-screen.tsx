"use client";

import Link from "next/link";
import { Users, UserCheck, Clock, Coins, TrendingUp, ClipboardCheck, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useManagerDashboard } from "@/hooks/use-manager";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency } from "@/lib/utils";

export function ManagerDashboardScreen() {
  const { data, isLoading } = useManagerDashboard();

  const counts = [
    { label: "Afiliados ativos", icon: UserCheck, value: data?.affiliatesActive ?? 0 },
    { label: "Aprovações pendentes", icon: Clock, value: data?.affiliatesPending ?? 0 },
    { label: "Jogadores na rede", icon: Users, value: data?.playersReferred ?? 0 },
  ];

  const paidToAffiliates = [
    { label: "Hoje", cents: data?.paidToAffiliatesTodayCents ?? 0 },
    { label: "Últimos 7 dias", cents: data?.paidToAffiliates7dCents ?? 0 },
    { label: "Últimos 30 dias", cents: data?.paidToAffiliates30dCents ?? 0 },
    { label: "Total acumulado", cents: data?.paidToAffiliatesTotalCents ?? 0 },
  ];

  const keptByManager = [
    { label: "Hoje", cents: data?.keptByManagerTodayCents ?? 0 },
    { label: "Últimos 7 dias", cents: data?.keptByManager7dCents ?? 0 },
    { label: "Últimos 30 dias", cents: data?.keptByManager30dCents ?? 0 },
    { label: "Total acumulado", cents: data?.keptByManagerTotalCents ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Visão <span className="text-gradient-brand">Geral</span>
        </h1>
        <p className="text-text-secondary mt-2">
          Desempenho comercial da sua rede de afiliados — dados informativos, sem acesso financeiro.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {counts.map((c) => (
          <Card key={c.label} className="p-4 flex flex-col gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-purple/15 text-purple">
              <c.icon className="size-4" />
            </span>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-xl md:text-2xl font-extrabold tabular-nums">
                <AnimatedNumber value={c.value} format={(v) => String(Math.round(v))} />
              </p>
            )}
            <p className="text-xs text-text-secondary leading-tight">{c.label}</p>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-bold text-lg mb-3">Pago aos afiliados (informativo)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {paidToAffiliates.map((c) => (
            <Card key={c.label} className="p-4 flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-green/15 text-green">
                <Coins className="size-4" />
              </span>
              {isLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-xl md:text-2xl font-extrabold tabular-nums">
                  <AnimatedNumber value={centsToReais(c.cents)} format={formatCurrency} />
                </p>
              )}
              <p className="text-xs text-text-secondary leading-tight">{c.label}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-lg mb-3">Recebido por você</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {keptByManager.map((c) => (
            <Card key={c.label} className="p-4 flex flex-col gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-purple/15 text-purple">
                <Coins className="size-4" />
              </span>
              {isLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-xl md:text-2xl font-extrabold tabular-nums">
                  <AnimatedNumber value={centsToReais(c.cents)} format={formatCurrency} />
                </p>
              )}
              <p className="text-xs text-text-secondary leading-tight">{c.label}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold">Aprovações pendentes</p>
            <p className="text-xs text-text-secondary">Cadastros de afiliados aguardando sua decisão.</p>
          </div>
          <Link href="/approvals">
            <Button variant="secondary" size="sm">
              Ver <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green to-emerald-400 text-[#05261c]">
            <TrendingUp className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold">Minha rede</p>
            <p className="text-xs text-text-secondary">Acompanhe o desempenho dos seus afiliados.</p>
          </div>
          <Link href="/network">
            <Button variant="secondary" size="sm">
              Ver <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
