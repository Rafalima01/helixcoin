"use client";

import { AlertTriangle, Download, RefreshCw, CreditCard, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  KpiGrid,
  SectionCard,
  StatusBadge,
  DataTable,
  type TableColumn,
} from "@/components/admin/ui";
import { AreaChart, BarChart, DonutChart } from "@/components/admin/charts";
import { AdminServices } from "@/lib/admin/services";
import { useAdminData, notImplemented } from "@/lib/admin/use-admin-data";
import { labeledSeries, HOURS, DAYS } from "@/lib/admin/mock-data";
import type { AuditEntryDTO } from "@/lib/admin/types";
import { formatCurrency, cn } from "@/lib/utils";

const revenueSeries = labeledSeries(31, HOURS, 26000, 9000);
const depositsByDay = labeledSeries(32, DAYS, 720000, 220000);
const gatewayVolume = [
  { label: "PixFast", value: 412300 },
  { label: "PagLuz", value: 286500 },
  { label: "TurboPay", value: 143510 },
];

const eventColumns: TableColumn<AuditEntryDTO>[] = [
  {
    key: "severity",
    header: "Nível",
    render: (r) => (
      <StatusBadge
        tone={
          r.severity === "critical" ? "danger" : r.severity === "warning" ? "warning" : "neutral"
        }
      >
        {r.severity === "critical" ? "Crítico" : r.severity === "warning" ? "Atenção" : "Info"}
      </StatusBadge>
    ),
  },
  {
    key: "action",
    header: "Evento",
    render: (r) => <span className="font-medium">{r.action}</span>,
  },
  {
    key: "actor",
    header: "Autor",
    render: (r) => <span className="text-text-secondary">{r.actor}</span>,
  },
  {
    key: "target",
    header: "Alvo",
    render: (r) => <code className="text-xs text-text-muted">{r.target}</code>,
  },
  {
    key: "createdAt",
    header: "Quando",
    align: "right",
    render: (r) => <span className="text-xs text-text-muted">{r.createdAt}</span>,
  },
];

export default function AdminDashboardPage() {
  const { data: kpis, loading: kpisLoading } = useAdminData(AdminServices.dashboardKpis);
  const { data: alerts, loading: alertsLoading } = useAdminData(AdminServices.alerts);
  const { data: events, loading: eventsLoading } = useAdminData(AdminServices.recentEvents);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard Geral"
        description="Visão em tempo real da operação. Dados simulados — Fase 1."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={notImplemented}>
              <Download className="size-4" /> Exportar
            </Button>
            <Button variant="primary" size="sm" onClick={notImplemented}>
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </>
        }
      />

      {kpisLoading || !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <KpiGrid kpis={kpis} />
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Receita (GGR) — últimas 24h"
          description="Receita bruta de jogo por faixa horária"
          className="xl:col-span-2"
        >
          <AreaChart data={revenueSeries} formatValue={(v) => formatCurrency(v)} height={210} />
        </SectionCard>

        <SectionCard
          title="Volume por gateway (24h)"
          description="Depósitos processados por provedor"
        >
          <DonutChart data={gatewayVolume} formatValue={(v) => formatCurrency(v)} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Building2 className="size-3" /> Casas conectadas
              </p>
              <p className="text-lg font-extrabold tabular-nums">3</p>
            </div>
            <div className="rounded-xl border border-border bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <CreditCard className="size-3" /> Gateways ativos
              </p>
              <p className="text-lg font-extrabold tabular-nums">2/4</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Depósitos por dia"
          description="Volume bruto — últimos 7 dias"
          className="xl:col-span-2"
        >
          <BarChart data={depositsByDay} formatValue={(v) => formatCurrency(v)} height={210} />
        </SectionCard>

        <SectionCard title="Alertas ativos" description="Eventos que exigem atenção">
          {alertsLoading || !alerts ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-xl border p-3",
                    a.severity === "critical"
                      ? "border-error/35 bg-error/[0.06]"
                      : a.severity === "warning"
                        ? "border-warning/35 bg-warning/[0.06]"
                        : "border-border bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        a.severity === "critical"
                          ? "text-error"
                          : a.severity === "warning"
                            ? "text-warning"
                            : "text-text-muted"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{a.title}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{a.detail}</p>
                      <p className="mt-1 text-[10px] text-text-muted">{a.createdAt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Eventos críticos e logs recentes"
        description="Últimas ações administrativas e eventos do sistema"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={notImplemented}
            className="border border-border"
          >
            Ver auditoria completa
          </Button>
        }
        className="p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5"
      >
        <div className="-mx-0">
          <DataTable
            columns={eventColumns}
            rows={events ?? []}
            loading={eventsLoading}
            pageSize={5}
          />
        </div>
      </SectionCard>

      <Card className="p-4">
        <p className="text-xs text-text-muted">
          <span className="font-semibold text-text-secondary">Fase 1 — Mockup navegável.</span>{" "}
          Todos os números desta tela são simulados e serão substituídos por dados reais via camada
          de serviços (WebSockets + API) nas próximas fases, sem alteração de interface.
        </p>
      </Card>
    </div>
  );
}
