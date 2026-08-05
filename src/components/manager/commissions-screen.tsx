"use client";

import { Coins, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useManagerDashboard } from "@/hooks/use-manager";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency } from "@/lib/utils";

export function ManagerCommissionsScreen() {
  const { data, isLoading } = useManagerDashboard();

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
          Comiss<span className="text-gradient-brand">ões</span>
        </h1>
        <p className="text-text-secondary mt-2">Total de comissões geradas pela sua rede de afiliados.</p>
      </div>

      <Card className="p-4 flex items-start gap-3 border-purple/20 bg-purple/[0.04]">
        <Info className="size-4 text-purple shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Estes valores são apenas informativos e refletem o total gerado pela sua rede. Você não tem acesso à
          carteira, ao ledger ou a qualquer dado financeiro da plataforma.
        </p>
      </Card>

      <div>
        <h2 className="font-bold text-lg mb-3">Pago aos afiliados</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {paidToAffiliates.map((p) => (
            <Card key={p.label} className="p-5 flex flex-col gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-green/15 text-green">
                <Coins className="size-4" />
              </span>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-extrabold tabular-nums">
                  <AnimatedNumber value={centsToReais(p.cents)} format={formatCurrency} />
                </p>
              )}
              <p className="text-sm text-text-secondary">{p.label}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-lg mb-3">Recebido por você</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {keptByManager.map((p) => (
            <Card key={p.label} className="p-5 flex flex-col gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-purple/15 text-purple">
                <Coins className="size-4" />
              </span>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="text-2xl font-extrabold tabular-nums">
                  <AnimatedNumber value={centsToReais(p.cents)} format={formatCurrency} />
                </p>
              )}
              <p className="text-sm text-text-secondary">{p.label}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
