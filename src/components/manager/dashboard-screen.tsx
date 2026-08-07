"use client";

import Link from "next/link";
import { TrendingUp, ClipboardCheck, ArrowRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiGrid, KpiGridSkeleton, HeroKpiGrid } from "@/components/admin/ui";
import { useManagerDashboard } from "@/hooks/use-manager";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency } from "@/lib/utils";
import type { KpiDTO } from "@/lib/admin/types";

export function ManagerDashboardScreen() {
  const { data, isLoading } = useManagerDashboard();

  const counts: KpiDTO[] = [
    { id: "affiliates-active", label: "Afiliados ativos", value: String(data?.affiliatesActive ?? 0) },
    { id: "affiliates-pending", label: "Aprovações pendentes", value: String(data?.affiliatesPending ?? 0) },
    { id: "players-referred", label: "Jogadores na rede", value: String(data?.playersReferred ?? 0) },
  ];

  const paidToAffiliates: KpiDTO[] = [
    { id: "paid-today", label: "Hoje", value: formatCurrency(centsToReais(data?.paidToAffiliatesTodayCents ?? 0)) },
    { id: "paid-7d", label: "Últimos 7 dias", value: formatCurrency(centsToReais(data?.paidToAffiliates7dCents ?? 0)) },
    { id: "paid-30d", label: "Últimos 30 dias", value: formatCurrency(centsToReais(data?.paidToAffiliates30dCents ?? 0)) },
    { id: "paid-total", label: "Total acumulado", value: formatCurrency(centsToReais(data?.paidToAffiliatesTotalCents ?? 0)) },
  ];

  const keptByManager: KpiDTO[] = [
    { id: "kept-today", label: "Hoje", value: formatCurrency(centsToReais(data?.keptByManagerTodayCents ?? 0)) },
    { id: "kept-7d", label: "Últimos 7 dias", value: formatCurrency(centsToReais(data?.keptByManager7dCents ?? 0)) },
    { id: "kept-30d", label: "Últimos 30 dias", value: formatCurrency(centsToReais(data?.keptByManager30dCents ?? 0)) },
    { id: "kept-total", label: "Total acumulado", value: formatCurrency(centsToReais(data?.keptByManagerTotalCents ?? 0)) },
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

      <Card className="p-4 flex items-start gap-3 border-purple/20 bg-purple/[0.04]">
        <Info className="size-4 text-purple shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Estes valores são apenas informativos e refletem o total gerado pela sua rede. Você não tem acesso à
          carteira, ao ledger ou a qualquer dado financeiro da plataforma.
        </p>
      </Card>

      {/* Hero treatment — same weight as the Admin dashboard's top row, so this never reads as a "secondary" panel. */}
      {isLoading ? <KpiGridSkeleton count={3} variant="hero" /> : <HeroKpiGrid kpis={counts} />}

      <div>
        <h2 className="font-bold text-lg mb-3">Pago aos afiliados (informativo)</h2>
        {isLoading ? <KpiGridSkeleton count={4} /> : <KpiGrid kpis={paidToAffiliates} />}
      </div>

      <div>
        <h2 className="font-bold text-lg mb-3">Recebido por você</h2>
        {isLoading ? <KpiGridSkeleton count={4} /> : <KpiGrid kpis={keptByManager} />}
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
