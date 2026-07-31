"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AlertTriangle, Download, RefreshCw, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  KpiGrid,
  SectionCard,
  DataTable,
  type TableColumn,
} from "@/components/admin/ui";
import { AreaChart, BarChart, DonutChart } from "@/components/admin/charts";
import { DashboardAdminApi } from "@/lib/admin/dashboard-api";
import { IdentityAdminApi } from "@/lib/admin/identity-api";
import { notImplemented } from "@/lib/admin/use-admin-data";
import type { KpiDTO } from "@/lib/admin/types";
import type { AuditLogResponseDto } from "@/modules/identity/dto/audit.dto";
import { formatCurrency, cn } from "@/lib/utils";

const DASHBOARD_DAYS = 7;

function pctDelta(current: number, prev: number): { delta?: string; trend: "up" | "down" | "flat" } {
  if (prev === 0) {
    if (current === 0) return { trend: "flat" };
    return { delta: "novo", trend: "up" };
  }
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return { delta: "0%", trend: "flat" };
  return { delta: `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`, trend: pct > 0 ? "up" : "down" };
}

function centsToReais(cents: number): number {
  return cents / 100;
}

const eventColumns: TableColumn<AuditLogResponseDto>[] = [
  {
    key: "action",
    header: "Evento",
    render: (r) => <span className="font-medium">{r.action}</span>,
  },
  {
    key: "actor",
    header: "Autor",
    render: (r) => (
      <div className="min-w-0">
        <code className="text-xs text-text-secondary truncate">{r.actorId ?? "sistema"}</code>
        <p className="text-[10px] uppercase text-text-muted">{r.actorType}</p>
      </div>
    ),
  },
  {
    key: "target",
    header: "Alvo",
    render: (r) => (
      <code className="text-xs text-text-muted">
        {r.entityType}
        {r.entityId ? `#${r.entityId.slice(0, 8)}` : ""}
      </code>
    ),
  },
  {
    key: "createdAt",
    header: "Quando",
    align: "right",
    render: (r) => <span className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleString("pt-BR")}</span>,
  },
];

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin", "dashboard", "summary", DASHBOARD_DAYS],
    queryFn: () => DashboardAdminApi.getSummary(DASHBOARD_DAYS),
  });
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ["admin", "dashboard", "recent-events"],
    queryFn: () => IdentityAdminApi.searchAudit({ page: 1, pageSize: 5 }),
  });

  const summary = summaryRes?.data;
  const events = eventsRes?.data ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    toast.success("Dados atualizados");
  };

  const kpis: KpiDTO[] | undefined = summary
    ? [
        {
          id: "deposits",
          label: `Depósitos (${DASHBOARD_DAYS}d)`,
          value: formatCurrency(centsToReais(summary.kpis.depositsCents)),
          ...pctDelta(summary.kpis.depositsCents, summary.kpis.depositsPrevCents),
        },
        {
          id: "withdrawals",
          label: `Saques (${DASHBOARD_DAYS}d)`,
          value: formatCurrency(centsToReais(summary.kpis.withdrawalsCents)),
          ...pctDelta(summary.kpis.withdrawalsCents, summary.kpis.withdrawalsPrevCents),
        },
        {
          id: "new-players",
          label: `Novos jogadores (${DASHBOARD_DAYS}d)`,
          value: String(summary.kpis.newPlayers),
          ...pctDelta(summary.kpis.newPlayers, summary.kpis.newPlayersPrev),
        },
        {
          id: "ggr",
          label: `GGR (${DASHBOARD_DAYS}d)`,
          value: formatCurrency(centsToReais(summary.kpis.ggrCents)),
          ...pctDelta(summary.kpis.ggrCents, summary.kpis.ggrPrevCents),
        },
        {
          id: "ngr",
          label: `NGR (${DASHBOARD_DAYS}d)`,
          value: formatCurrency(centsToReais(summary.ngrCents)),
          ...pctDelta(summary.ngrCents, summary.ngrPrevCents),
        },
      ]
    : undefined;

  const depositsByDay = summary?.depositsByDay.map((p) => ({ label: p.label, value: centsToReais(p.valueCents) })) ?? [];
  const gatewayVolume = summary?.gatewayVolume.map((p) => ({ label: p.label, value: centsToReais(p.valueCents) })) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard Geral"
        description="Visão em tempo real da operação, últimos 7 dias."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={notImplemented}>
              <Download className="size-4" /> Exportar
            </Button>
            <Button variant="primary" size="sm" onClick={handleRefresh}>
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </>
        }
      />

      {summaryLoading || !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <KpiGrid kpis={kpis} />
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Depósitos por dia"
          description={`Volume bruto — últimos ${DASHBOARD_DAYS} dias`}
          className="xl:col-span-2"
        >
          {summaryLoading ? (
            <Skeleton className="h-[210px] w-full rounded-xl" />
          ) : (
            <AreaChart data={depositsByDay} formatValue={(v) => formatCurrency(v)} height={210} />
          )}
        </SectionCard>

        <SectionCard
          title="Volume por gateway"
          description={`Depósitos confirmados — últimos ${DASHBOARD_DAYS} dias`}
        >
          {summaryLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : gatewayVolume.length > 0 ? (
            <DonutChart data={gatewayVolume} formatValue={(v) => formatCurrency(v)} />
          ) : (
            <p className="text-sm text-text-muted">Nenhum depósito confirmado no período.</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Building2 className="size-3" /> Casas conectadas
              </p>
              <p className="text-lg font-extrabold tabular-nums">{summary?.connectedGateways ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <CreditCard className="size-3" /> Gateways ativos
              </p>
              <p className="text-lg font-extrabold tabular-nums">
                {summary ? `${summary.activeGateways}/${summary.connectedGateways}` : "—"}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Depósitos por dia (barras)"
          description="Mesma série, visão em barras"
          className="xl:col-span-2"
        >
          {summaryLoading ? (
            <Skeleton className="h-[210px] w-full rounded-xl" />
          ) : (
            <BarChart data={depositsByDay} formatValue={(v) => formatCurrency(v)} height={210} />
          )}
        </SectionCard>

        <SectionCard title="Alertas ativos" description="Eventos que exigem atenção">
          {summaryLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : !summary || summary.alerts.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhum alerta ativo.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {summary.alerts.map((a) => (
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Eventos recentes"
        description="Últimas ações administrativas (AuditLog)"
        actions={
          <Link href="/audit">
            <Button variant="ghost" size="sm" className="border border-border">
              Ver auditoria completa
            </Button>
          </Link>
        }
        className="p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5"
      >
        <div className="-mx-0">
          <DataTable columns={eventColumns} rows={events} loading={eventsLoading} pageSize={5} />
        </div>
      </SectionCard>
    </div>
  );
}
