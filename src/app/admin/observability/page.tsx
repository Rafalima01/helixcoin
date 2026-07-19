"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SectionCard, StatusBadge, Meter } from "@/components/admin/ui";
import { AreaChart } from "@/components/admin/charts";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData } from "@/lib/admin/use-admin-data";
import { labeledSeries, HOURS } from "@/lib/admin/mock-data";
import { cn } from "@/lib/utils";

const latency = labeledSeries(61, HOURS, 140, 60);
const errors = labeledSeries(62, HOURS, 12, 18);

const STATUS = {
  operational: { label: "Operacional", tone: "success" as const },
  degraded: { label: "Degradado", tone: "warning" as const },
  down: { label: "Fora do ar", tone: "danger" as const },
};

export default function AdminObservabilityPage() {
  const { data, loading } = useAdminData(AdminServices.serviceHealth);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Observabilidade"
        description="Saúde dos serviços, latência e taxa de erro. Fonte futura: métricas via OpenTelemetry."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {loading || !data
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)
          : data.map((s) => (
              <Card key={s.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-bold">{s.name}</code>
                  <StatusBadge tone={STATUS[s.status].tone} pulse={s.status !== "down"}>
                    {STATUS[s.status].label}
                  </StatusBadge>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-text-muted">Uptime (30d)</span>
                    <span className="font-bold tabular-nums">{s.uptime}%</span>
                  </div>
                  <Meter value={s.uptime} tone={s.uptime > 99.9 ? "green" : "warning"} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">p95</span>
                  <span className={cn("font-bold tabular-nums", s.latencyP95Ms > 500 ? "text-warning" : "")}>{s.latencyP95Ms} ms</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Erros</span>
                  <span className={cn("font-bold tabular-nums", s.errorRate > 1 ? "text-error" : "")}>{s.errorRate}%</span>
                </div>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Latência p95 (ms)" description="Agregada — últimas 24h">
          <AreaChart data={latency} color="#7DD3FC" height={200} formatValue={(v) => `${v} ms`} />
        </SectionCard>
        <SectionCard title="Erros por hora" description="Todos os serviços — últimas 24h">
          <AreaChart data={errors} color="#FF4D6D" height={200} formatValue={(v) => `${v} erros`} />
        </SectionCard>
      </div>
    </div>
  );
}
