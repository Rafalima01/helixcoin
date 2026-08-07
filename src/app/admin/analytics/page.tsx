"use client";

import { PageHeader, ChartCard, KpiGrid } from "@/components/admin/ui";
import { AreaChart, BarChart, DonutChart } from "@/components/admin/charts";
import { labeledSeries, DAYS, HOURS } from "@/lib/admin/mock-data";

const dau = labeledSeries(51, DAYS, 9200, 2400);
const sessionsByHour = labeledSeries(52, HOURS, 1500, 700);
const retention = [
  { label: "D1", value: 46 },
  { label: "D3", value: 31 },
  { label: "D7", value: 22 },
  { label: "D14", value: 15 },
  { label: "D30", value: 9 },
];
const acquisition = [
  { label: "Afiliados", value: 44 },
  { label: "Orgânico", value: 27 },
  { label: "Social Ads", value: 18 },
  { label: "Influencers", value: 11 },
];

const KPIS = [
  { id: "dau", label: "DAU", value: "11.482", delta: "+6,3%", trend: "up" as const },
  { id: "mau", label: "MAU", value: "84.210", delta: "+12%", trend: "up" as const },
  { id: "sess", label: "Sessões / usuário", value: "4,7", delta: "+0,4", trend: "up" as const },
  { id: "dur", label: "Duração média", value: "9m 12s", delta: "-3%", trend: "down" as const },
];

export default function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Analytics"
        description="Comportamento de produto e aquisição. Fonte futura: eventos em tempo real via pipeline de dados."
        mock
      />
      <KpiGrid kpis={KPIS} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Usuários ativos por dia" description="Últimos 7 dias">
          <AreaChart data={dau} height={200} formatValue={(v) => v.toLocaleString("pt-BR")} />
        </ChartCard>
        <ChartCard title="Sessões por hora" description="Distribuição nas últimas 24h">
          <BarChart
            data={sessionsByHour}
            color="#FF4FAE"
            height={200}
            formatValue={(v) => v.toLocaleString("pt-BR")}
          />
        </ChartCard>
        <ChartCard title="Retenção de coortes" description="% de jogadores que retornam">
          <BarChart data={retention} color="#7DD3FC" height={200} formatValue={(v) => `${v}%`} />
        </ChartCard>
        <ChartCard title="Aquisição por canal" description="Novos cadastros (30d)">
          <DonutChart data={acquisition} formatValue={(v) => `${v}%`} />
        </ChartCard>
      </div>
    </div>
  );
}
