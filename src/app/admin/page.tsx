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
  KpiGridSkeleton,
  HeroKpiGrid,
  SectionCard,
  ChartCard,
  DataTable,
  AdminTabs,
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
          <option key={o.value} value={o.value}>
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

const STATS_TABS = [
  { key: "overview", label: "Visão geral", description: "Usuários, cadastros e aquisição no período" },
  { key: "financial", label: "Financeiro", description: "Depósitos, saques, GGR e resultado no período" },
  { key: "game", label: "Jogo", description: "Partidas, cashouts e RTP realizado no período" },
  { key: "commercial", label: "Comercial", description: "Afiliados, gerentes e comissão gerada no período" },
] as const;

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<DateRangePreset>("7d");
  const [customFrom, setCustomFrom] = useState(daysAgoISO(7));
  const [customTo, setCustomTo] = useState(todayISO());
  const [statsTab, setStatsTab] = useState<(typeof STATS_TABS)[number]["key"]>("overview");

  const customReady = preset !== "custom" || (!!customFrom && !!customTo && customFrom <= customTo);
  const queryKey = ["admin", "dashboard", "summary", preset, preset === "custom" ? customFrom : null, preset === "custom" ? customTo : null];

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey,
    queryFn: () => DashboardAdminApi.getSummary(preset, preset === "custom" ? { dateFrom: customFrom, dateTo: customTo } : undefined),
    enabled: customReady,
  });
  const { data: eventsRes, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useQuery({
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

  /**
   * The 4 "hero" métricas the design audit calls for (§2 P1, §3 Fase 3, §6
   * passo 08) — GGR, Depósitos, Lucro líquido, Usuários ativos — chosen with
   * the user as the platform's overall-health signal, always visible above
   * the (now trimmed) grouped sections. Pulled straight from the same
   * `summary` fields already used below — no new data.
   */
  const heroKpis: KpiDTO[] | undefined = useMemo(() => {
    if (!summary) return undefined;
    return [
      {
        id: "hero-ggr",
        label: "GGR",
        value: formatCurrency(centsToReais(summary.kpis.ggrCents)),
        ...pctDelta(summary.kpis.ggrCents, summary.kpis.ggrPrevCents),
      },
      {
        id: "hero-deposits",
        label: "Depósitos",
        value: formatCurrency(centsToReais(summary.kpis.depositsCents)),
        ...pctDelta(summary.kpis.depositsCents, summary.kpis.depositsPrevCents),
      },
      { id: "hero-net-profit", label: "Lucro líquido", value: formatCurrency(centsToReais(summary.financial.netProfitCents)) },
      { id: "hero-active-users", label: "Usuários ativos", value: fmtNumber(summary.users.activeUsers) },
    ];
  }, [summary]);

  /**
   * Trimmed from 9 to 4 (design audit §2 P1, §6 passo 08): NGR, os 3 custos
   * detalhados e a margem já vivem em /finance › "Resultado do dia" —
   * mantidos aqui apenas os totais que respondem "como está o financeiro
   * agora" sem abrir outra tela.
   */
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
      { id: "net-profit", label: "Lucro líquido", value: formatCurrency(centsToReais(summary.financial.netProfitCents)) },
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

  /**
   * Trimmed from 9 to 4 (design audit §2 P1, §6 passo 08): a rede de
   * afiliados/gerentes já tem detalhe completo (CPA, RevShare, depósitos
   * gerados, FTDs) em /affiliate-commissions e /managers — mantidos aqui só
   * os totais que resumem o canal comercial de relance.
   */
  const commercialKpis: KpiDTO[] | undefined = useMemo(() => {
    if (!summary) return undefined;
    return [
      { id: "active-affiliates", label: "Afiliados ativos", value: fmtNumber(summary.commercial.activeAffiliates) },
      { id: "active-managers", label: "Gerentes ativos", value: fmtNumber(summary.commercial.activeManagers) },
      { id: "commission-generated", label: "Comissão gerada (total)", value: formatCurrency(centsToReais(summary.commercial.commissionGeneratedCents)) },
      { id: "pct-distributed", label: "% da receita distribuída", value: fmtPct(summary.commercial.pctGgrDistributed) },
    ];
  }, [summary]);

  const depositsByDay = summary?.depositsByDay.map((p) => ({ label: p.label, value: centsToReais(p.valueCents) })) ?? [];
  const signupsByDay = summary?.signupsByDay.map((p) => ({ label: p.label, value: p.value })) ?? [];
  const ggrByDay = summary?.ggrByDay.map((p) => ({ label: p.label, value: centsToReais(p.ggrCents) })) ?? [];
  const gatewayVolume = summary?.gatewayVolume.map((p) => ({ label: p.label, value: centsToReais(p.valueCents) })) ?? [];

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

      {summaryLoading || !heroKpis ? (
        <KpiGridSkeleton count={4} variant="hero" />
      ) : (
        <HeroKpiGrid kpis={heroKpis} />
      )}

      {/*
       * Editorial pass (redesign premium, "menos informação, mais foco"):
       * the 4 stat groups used to render as 4 SectionCards stacked in the
       * page flow (27 tiles always on screen at once). Same data, same
       * KpiGrid, but now behind one AdminTabs switch — only one group's
       * numbers are on screen at a time, and the page doesn't turn into a
       * scroll of small boxes before you even reach the charts.
       */}
      <SectionCard
        title={STATS_TABS.find((t) => t.key === statsTab)!.label}
        description={STATS_TABS.find((t) => t.key === statsTab)!.description}
        actions={<AdminTabs tabs={STATS_TABS.map(({ key, label }) => ({ key, label }))} value={statsTab} onChange={(k) => setStatsTab(k as typeof statsTab)} />}
      >
        {statsTab === "overview" &&
          (summaryLoading || !overviewKpis ? <KpiGridSkeleton count={9} /> : <KpiGrid kpis={overviewKpis} />)}
        {statsTab === "financial" &&
          (summaryLoading || !financialKpis ? <KpiGridSkeleton count={4} /> : <KpiGrid kpis={financialKpis} />)}
        {statsTab === "game" &&
          (summaryLoading || !gameKpis ? <KpiGridSkeleton count={10} /> : <KpiGrid kpis={gameKpis} />)}
        {statsTab === "commercial" &&
          (summaryLoading || !commercialKpis ? <KpiGridSkeleton count={4} /> : <KpiGrid kpis={commercialKpis} />)}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Depósitos por dia" description="Volume bruto — período selecionado" className="xl:col-span-2">
          {summaryLoading ? <Skeleton className="h-[210px] w-full rounded-xl" /> : <AreaChart data={depositsByDay} formatValue={(v) => formatCurrency(v)} height={210} />}
        </ChartCard>

        <ChartCard title="Volume por gateway" description="Depósitos confirmados — período selecionado">
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
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Novos cadastros por dia" description="Jogadores (role USER) — período selecionado" className="xl:col-span-2">
          {summaryLoading ? <Skeleton className="h-[210px] w-full rounded-xl" /> : <BarChart data={signupsByDay} height={210} />}
        </ChartCard>

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

      <ChartCard title="GGR / NGR por dia" description="Receita bruta e líquida — período selecionado">
        {summaryLoading ? <Skeleton className="h-[210px] w-full rounded-xl" /> : <AreaChart data={ggrByDay} formatValue={(v) => formatCurrency(v)} height={210} />}
      </ChartCard>

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
          <DataTable columns={eventColumns} rows={events} loading={eventsLoading} error={eventsError} onRetry={refetchEvents} pageSize={5} />
        </div>
      </SectionCard>
    </div>
  );
}
