"use client";

import { useMemo, useState } from "react";
import type { MatchSummaryDto } from "@/modules/match-engine/dto/match.dto";
import {
  Gamepad2,
  Trophy,
  Skull,
  Percent,
  Inbox,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Wallet,
  Target,
  Layers,
  Timer,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip } from "@/components/ui/chip";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { useMatchesList } from "@/hooks/use-profile";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, formatMultiplier, cn } from "@/lib/utils";

type FilterKey = "all" | "today" | "yesterday" | "week" | "month" | "custom";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeFor(filter: FilterKey, from: string, to: string): [Date, Date] | null {
  const now = new Date();
  const today = startOfDay(now);
  switch (filter) {
    case "all":
      return null;
    case "today":
      return [today, now];
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return [y, today];
    }
    case "week": {
      const w = new Date(today);
      w.setDate(w.getDate() - w.getDay());
      return [w, now];
    }
    case "month": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return [m, now];
    }
    case "custom": {
      if (!from && !to) return null;
      const f = from ? new Date(`${from}T00:00:00`) : new Date(0);
      const t = to ? new Date(`${to}T23:59:59`) : now;
      return [f, t];
    }
  }
}

function duration(match: MatchSummaryDto): string {
  if (!match.resolvedAt) return "—";
  const ms = new Date(match.resolvedAt).getTime() - new Date(match.createdAt).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(s / 60);
  return min > 0 ? `${min}m ${s % 60}s` : `${s}s`;
}

function Field({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-text-muted flex items-center gap-1">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("text-[13px] font-semibold tabular-nums truncate", className)}>
        {value}
      </span>
    </div>
  );
}

function MatchCard({ match }: { match: MatchSummaryDto }) {
  const won = match.status === "CASHED_OUT";
  const date = new Date(match.createdAt);
  const goalPct =
    match.targetMultiplier > 1
      ? Math.round(Math.min(1, (match.multiplier - 1) / (match.targetMultiplier - 1)) * 100)
      : 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 backdrop-blur-md transition-colors",
        won
          ? "border-green/35 bg-green/[0.06] hover:bg-green/[0.09]"
          : "border-error/35 bg-error/[0.06] hover:bg-error/[0.09]"
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
            won ? "bg-green/15 text-green" : "bg-error/15 text-error"
          )}
        >
          {won ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {won ? "Vitória" : "Derrota"}
        </span>
        <span className={cn("font-extrabold tabular-nums", won ? "text-green" : "text-error")}>
          {won
            ? `+${formatCurrency(centsToReais(match.payout ?? 0))}`
            : `-${formatCurrency(centsToReais(match.betAmount))}`}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2.5">
        <Field icon={Calendar} label="Data" value={date.toLocaleDateString("pt-BR")} />
        <Field
          icon={Clock}
          label="Hora"
          value={date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        />
        <Field
          icon={Wallet}
          label="Apostado"
          value={formatCurrency(centsToReais(match.betAmount))}
        />
        <Field
          icon={TrendingUp}
          label="Multiplicador"
          value={formatMultiplier(match.multiplier)}
          className={won ? "text-green" : undefined}
        />
        <Field icon={Target} label="Meta" value={formatMultiplier(match.targetMultiplier)} />
        <Field
          icon={Percent}
          label="% da meta"
          value={`${goalPct}%`}
          className={goalPct >= 100 ? "text-green" : undefined}
        />
        <Field icon={Layers} label="Plataformas" value={String(match.platformsPassed)} />
        <Field icon={Timer} label="Tempo" value={duration(match)} />
      </div>
    </div>
  );
}

export function GameHistory() {
  const { data, isLoading } = useMatchesList();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const matches = useMemo(() => {
    const all = data ?? [];
    const range = rangeFor(filter, from, to);
    if (!range) return all;
    const [start, end] = range;
    return all.filter((m) => {
      const d = new Date(m.createdAt);
      return d >= start && d <= end;
    });
  }, [data, filter, from, to]);

  const wins = matches.filter((m) => m.status === "CASHED_OUT").length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  const secondary = [
    { label: "Partidas", icon: Gamepad2, value: matches.length },
    { label: "Resgates", icon: Trophy, value: wins },
    { label: "Derrotas", icon: Skull, value: losses },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Stats — 1 hero number (the one that summarizes performance) + the
          rest grouped as a compact list, not 4 identical boxes. */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Card variant="hero-number" className="flex flex-col gap-2">
          <Percent className="size-5 text-gold" />
          <p className="font-display text-3xl md:text-4xl font-extrabold text-gradient-gold tabular-nums">
            <AnimatedNumber value={winRate} format={(v) => `${Math.round(v)}%`} />
          </p>
          <p className="text-sm text-text-secondary">Taxa de vitória</p>
        </Card>
        <div className="flex sm:flex-col gap-2 sm:w-52">
          {secondary.map((s) => (
            <Card key={s.label} variant="list-row" className="flex flex-1 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple/15 text-purple">
                <s.icon className="size-3.5" />
              </span>
              <p className="flex-1 text-xs text-text-secondary min-w-0 truncate">{s.label}</p>
              <p className="text-sm font-bold tabular-nums shrink-0">
                <AnimatedNumber value={s.value} format={(v) => `${Math.round(v)}`} />
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {filter === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white/[0.03] px-3 text-sm outline-none focus:border-purple/60"
            />
          </label>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : matches.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-2 text-center">
          <Inbox className="size-7 text-text-muted" />
          <p className="text-sm text-text-secondary">Nenhuma partida encontrada neste período</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
