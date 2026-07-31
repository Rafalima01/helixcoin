"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import type { DateRangePreset } from "@/lib/date-range";
import type { AuditLogResponseDto } from "@/modules/identity/dto/audit.dto";
import { formatCurrency, cn } from "@/lib/utils";

const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "15d", label: "Últimos 15 dias" },
  { value: "month", label: "Este mês" },
  { value: "custom", label: "Personalizado" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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

/** null means "indisponível" (e.g. divide-by-zero) — never fabricated. */
function fmtPct(ratio: number | null, digits = 1): string {
  return ratio === null ? "indisponível" : `${(ratio * 100).toFixed(digits)}%`;
}

function fmtNumber(n: number | null): string {
  return n === null ? "indisponível" : n.toLocaleString("pt-BR");
}

function fmtMultiplier(n: number | null): string {
  return n === null ? "indisponível" : `${n.toFixed(2)}x`;
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

function PeriodFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  preset: DateRangePreset;
  onPresetChange: (p: DateRangePreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(e) => onPresetChange(e.target.value as DateRangePreset)}
        className="h-10 rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
      >
        {PRESET_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0B0815]">
            {o.label}
          </option>
        ))}
      </select>
      {preset === "custom" && (
        <>
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="h-10 rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          />
          <span className="text-xs text-text-muted">até</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={todayISO()}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="h-10 rounded-xl border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
          />
        </>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<DateRangePreset>("7d");
  const [customFrom, setCustomFrom] = useState(daysAgoISO(7));
  const [customTo, setCustomTo] = useState(todayISO());

  const customReady = preset !== "custom" || (!!customFrom && !!customTo && customFrom <= customTo);
  const queryKey = ["admin", "dashboard", "summary", preset, preset === "custom" ? customFrom : null, preset === "custom" ? customTo : null];

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey,
    queryFn: () => DashboardAdminApi.getSummary(preset, preset === "custom" ? { dateFrom: customFrom, dateTo: customTo } : undefined),
    enabled: customReady,
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

  const overviewKpis: KpiDTO[] | undefined = useMemo(() => {
    if (!summary) return undefined;
    return [
      { id: "total-users", label: "Usuários totais", value: fmtNumber(summary.users.totalUsers) },
      { id: "active-users", label: "Usuários ativos", value: fmtNumber(summary.users.activeUsers) },
      { id: "online", label: "Sessões recentes (~15min, aprox.)", value: fmtNumber(summary.users.approxOnlineSessions) },
      {
        id: "new-signups",
        label: "Novos cadastros",
        value: fmtNumber(summary.users.newSignups),
        ...pctDelta(summary.users.newSignups, summary.users.newSignupsPrev),
      },
      { id: "active-players", label: "Jogadores ativos no período", value: fmtNumber(summary.users.activePlayersInPeriod) },
      { id: "ftds", label: "FTDs", value: fmtNumber(summary.acquisition.ftds) },
      { id: "conversion", label: "Taxa de conversão (FTD/cadastro)", value: fmtPct(summary.acquisition.conversionRate) },
      { id: "depositors", label: "Depositantes", value: fmtNumber(summary.acquisition.depositors) },
      {
        id: "avg-ticket",
        label: "Ticket médio de depósito",
        value: summary.acquisition.avgDepositTicketCents === null ? "indisponível" : formatCurrency(centsToReais(summary.acquisition.avgDepositTicketCents)),
      },
    ];
  }, [summary]);

  const financialKpis: KpiDTO[] | undefined = useMemo(() => {
    if (!summary) return undefined;
    return [
      {
        id: "deposits",
        label: "Depósitos",
        value: formatCurrency(centsToReais(summary.kpis.depositsCents)),
        ...pctDelta(summary.kpis.depositsCents, summary.kpis.depositsPrevCents),
      },
      {
        id: "withdrawals",
        label: "Saques",
        value: formatCurrency(centsToReais(summary.kpis.withdrawalsCents)),
        ...pctDelta(summary.kpis.withdrawalsCents, summary.kpis.withdrawalsPrevCents),
      },
      {
        id: "ggr",
        label: "GGR",
        value: formatCurrency(centsToReais(summary.kpis.ggrCents)),
        ...pctDelta(summary.kpis.ggrCents, summary.kpis.ggrPrevCents),
      },
      {
        id: "ngr",
        label: "NGR",
        value: formatCurrency(centsToReais(summary.ngrCents)),
        ...pctDelta(summary.ngrCents, summary.ngrPrevCents),
      },
      { id: "bonus-cost", label: "Custo de bônus", value: formatCurrency(centsToReais(summary.financial.bonusCostCents)) },
      { id: "affiliate-cost", label: "Custo de afiliados (CPA + RevShare)", value: formatCurrency(centsToReais(summary.financial.affiliateCostCents)) },
      { id: "manager-cost", label: "Custo de gerentes (spread)", value: formatCurrency(centsToReais(summary.financial.managerSpreadCostCents)) },
      { id: "net-profit", label: "Lucro líquido", value: formatCurrency(centsToReais(summary.financial.netProfitCents)) },
      { id: "margin", label: "Margem líquida (lucro/GGR)", value: fmtPct(summary.financial.marginPct) },
    ];
  }, [summary]);

  const gameKpis: KpiDTO[] | undefined = useMemo(() => {
    if (!summary) return undefined;
    return [
      { id: "matches-started", label: "Partidas iniciadas", value: fmtNumber(summary.game.matchesStarted) },
      { id: "matches-completed", label: "Partidas concluídas", value: fmtNumber(summary.game.matchesCompleted) },
      { id: "matches-won", label: "Vitórias (cashout)", value: fmtNumber(summary.game.matchesWon) },
      { id: "matches-lost", label: "Derrotas", value: fmtNumber(summary.game.matchesLost) },
      { id: "completion-rate", label: "Taxa de conclusão", value: fmtPct(summary.game.completionRate) },
      { id: "cashout-rate", label: "Taxa de cashout", value: fmtPct(summary.game.cashoutRate) },
      { id: "avg-multiplier", label: "Multiplicador médio", value: fmtMultiplier(summary.game.avgMultiplier) },
      { id: "max-multiplier", label: "Maior multiplicador", value: fmtMultiplier(summary.game.maxMultiplier) },
      { id: "avg-platforms", label: "Plataformas/partida (média)", value: summary.game.avgPlatformsPerMatch === null ? "indisponível" : summary.game.avgPlatformsPerMatch.toFixed(1) },
      { id: "rtp", label: "RTP médio (realizado)", value: fmtPct(summary.game.avgRealizedRtpPct) },
    ];
  }, [summary]);

  const commercialKpis: KpiDTO[] | undefined = useMemo(() => {
    if (!summary) return undefined;
    return [
      { id: "active-affiliates", label: "Afiliados ativos", value: fmtNumber(summary.commercial.activeAffiliates) },
      { id: "active-managers", label: "Gerentes ativos", value: fmtNumber(summary.commercial.activeManagers) },
      { id: "affiliate-players", label: "Jogadores via afiliados (nível 1)", value: fmtNumber(summary.commercial.affiliateReferredPlayers) },
      { id: "affiliate-ftds", label: "FTDs de afiliados", value: fmtNumber(summary.commercial.affiliateFtds) },
      { id: "affiliate-deposits", label: "Depósitos gerados (nível 1)", value: formatCurrency(centsToReais(summary.commercial.affiliateDrivenDepositsCents)) },
      { id: "commission-generated", label: "Comissão gerada (total)", value: formatCurrency(centsToReais(summary.commercial.commissionGeneratedCents)) },
      { id: "cpa-paid", label: "CPA pago", value: formatCurrency(centsToReais(summary.commercial.cpaCostCents)) },
      { id: "revshare-paid", label: "Revenue Share pago", value: formatCurrency(centsToReais(summary.commercial.revshareCostCents)) },
      { id: "pct-distributed", label: "% da receita distribuída", value: fmtPct(summary.commercial.pctGgrDistributed) },
    ];
  }, [summary]);

  const depositsByDay = summary?.depositsByDay.map((p) => ({ label: p.label, value: centsToReais(p.valueCents) })) ?? [];
  const signupsByDay = summary?.signupsByDay.map((p) => ({ label: p.label, value: p.value })) ?? [];
  const ggrByDay = summary?.ggrByDay.map((p) => ({ label: p.label, value: centsToReais(p.ggrCents) })) ?? [];
  const gatewayVolume = summary?.gatewayVolume.map((p) => ({ label: p.label, value: centsToReais(p.valueCents) })) ?? [];

  const skeleton = (n: number) => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard Geral"
        description="Visão operacional da plataforma — dados reais, filtrados pelo período selecionado."
        actions={
          <>
            <PeriodFilter
              preset={preset}
              onPresetChange={setPreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFromChange={setCustomFrom}
              onCustomToChange={setCustomTo}
            />
            <Button variant="secondary" size="sm" onClick={notImplemented}>
              <Download className="size-4" /> Exportar
            </Button>
            <Button variant="primary" size="sm" onClick={handleRefresh}>
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </>
        }
      />

      <SectionCard title="Visão geral" description="Usuários, cadastros e aquisição no período">
        {summaryLoading || !overviewKpis ? skeleton(9) : <KpiGrid kpis={overviewKpis} />}
      </SectionCard>

      <SectionCard title="Financeiro" description="Depósitos, saques, GGR/NGR e custos no período">
        {summaryLoading || !financialKpis ? skeleton(9) : <KpiGrid kpis={financialKpis} accents={["#16F2A5", "#FF4FAE", "#8B5CF6", "#7DD3FC"]} />}
      </SectionCard>

      <SectionCard title="Jogo" description="Partidas, cashouts e RTP realizado no período">
        {summaryLoading || !gameKpis ? skeleton(10) : <KpiGrid kpis={gameKpis} accents={["#8B5CF6", "#7DD3FC", "#16F2A5", "#FF4FAE"]} />}
      </SectionCard>

      <SectionCard title="Comercial" description="Afiliados, gerentes e comissões no período — nível 1 direto">
        {summaryLoading || !commercialKpis ? skeleton(9) : <KpiGrid kpis={commercialKpis} accents={["#FF4FAE", "#8B5CF6", "#16F2A5", "#7DD3FC"]} />}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Depósitos por dia" description="Volume bruto — período selecionado" className="xl:col-span-2">
          {summaryLoading ? <Skeleton className="h-[210px] w-full rounded-xl" /> : <AreaChart data={depositsByDay} formatValue={(v) => formatCurrency(v)} height={210} />}
        </SectionCard>

        <SectionCard title="Volume por gateway" description="Depósitos confirmados — período selecionado">
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
        <SectionCard title="Novos cadastros por dia" description="Jogadores (role USER) — período selecionado" className="xl:col-span-2">
          {summaryLoading ? <Skeleton className="h-[210px] w-full rounded-xl" /> : <BarChart data={signupsByDay} height={210} />}
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

      <SectionCard title="GGR / NGR por dia" description="Receita bruta e líquida — período selecionado">
        {summaryLoading ? <Skeleton className="h-[210px] w-full rounded-xl" /> : <AreaChart data={ggrByDay} formatValue={(v) => formatCurrency(v)} height={210} />}
      </SectionCard>

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
