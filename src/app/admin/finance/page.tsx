"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionCard, DetailRow } from "@/components/admin/ui";
import { AreaChart, BarChart } from "@/components/admin/charts";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import { labeledSeries, MONTHS, DAYS } from "@/lib/admin/mock-data";
import { formatCurrency, cn } from "@/lib/utils";

const ggrMonthly = labeledSeries(41, MONTHS, 6200000, 1800000);
const netByDay = labeledSeries(42, DAYS, 180000, 70000);

export default function AdminFinancePage() {
  const { data, loading } = useAdminData(AdminServices.financeSummary);

  const summaryCards = data
    ? [
        { label: "GGR (24h)", value: data.ggr, tone: "text-white" },
        { label: "NGR (24h)", value: data.ngr, tone: "text-white" },
        { label: "Depósitos", value: data.deposits, tone: "text-green" },
        { label: "Saques", value: -data.withdrawals, tone: "text-pink" },
        { label: "Custo de bônus", value: -data.bonusCost, tone: "text-warning" },
        { label: "Tarifas de gateway", value: -data.gatewayFees, tone: "text-warning" },
        { label: "Custo de afiliados", value: -data.affiliateCost, tone: "text-warning" },
        { label: "Lucro líquido", value: data.netProfit, tone: "text-green" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Financeiro"
        description="Consolidação de receitas, custos e resultado. Fechamentos contábeis serão gerados pelo Backend."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
          : summaryCards.map((c) => (
              <Card key={c.label} className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">{c.label}</p>
                <p className={cn("text-lg font-extrabold tabular-nums", c.tone)}>
                  {c.value < 0 ? "−" : ""}
                  {formatCurrency(Math.abs(c.value))}
                </p>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="GGR mensal" description="Receita bruta de jogo — 2026" className="xl:col-span-2">
          <AreaChart data={ggrMonthly} color="#16F2A5" formatValue={(v) => formatCurrency(v)} height={220} />
        </SectionCard>

        <SectionCard title="Resultado do dia" description="Composição do lucro (24h)">
          {data && (
            <>
              <DetailRow label="GGR" value={formatCurrency(data.ggr)} />
              <DetailRow label="(−) Bônus" value={`− ${formatCurrency(data.bonusCost)}`} />
              <DetailRow label="(−) Gateways" value={`− ${formatCurrency(data.gatewayFees)}`} />
              <DetailRow label="(−) Afiliados" value={`− ${formatCurrency(data.affiliateCost)}`} />
              <DetailRow label="(−) Impostos provisionados" value={`− ${formatCurrency(data.ggr - data.bonusCost - data.gatewayFees - data.affiliateCost - data.netProfit)}`} />
              <div className="mt-2 rounded-xl border border-green/30 bg-green/10 px-3 py-2.5 flex items-center justify-between">
                <span className="text-sm font-bold">Lucro líquido</span>
                <span className="font-extrabold tabular-nums text-green">{formatCurrency(data.netProfit)}</span>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Lucro líquido por dia" description="Últimos 7 dias">
        <BarChart data={netByDay} color="#8B5CF6" formatValue={(v) => formatCurrency(v)} height={200} />
      </SectionCard>
    </div>
  );
}
