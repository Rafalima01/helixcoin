"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Gamepad2,
  Trophy,
  Gift,
  Percent,
  Coins,
  Inbox,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionsList } from "@/hooks/use-profile";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, cn } from "@/lib/utils";

const TYPE_META: Record<
  string,
  { label: string; icon: typeof Coins; tone: string; sign: "+" | "-" }
> = {
  DEPOSIT: { label: "Depósito", icon: ArrowDownToLine, tone: "text-green", sign: "+" },
  WITHDRAW: { label: "Saque", icon: ArrowUpFromLine, tone: "text-pink", sign: "-" },
  BET: { label: "Aposta", icon: Gamepad2, tone: "text-text-secondary", sign: "-" },
  PAYOUT: { label: "Resgate", icon: Trophy, tone: "text-green", sign: "+" },
  BONUS: { label: "Bônus", icon: Gift, tone: "text-purple", sign: "+" },
  CASHBACK: { label: "Cashback", icon: Coins, tone: "text-warning", sign: "+" },
  COMMISSION: { label: "Comissão", icon: Percent, tone: "text-purple", sign: "+" },
};

const STATUS_META: Record<string, { label: string; variant: "green" | "warning" | "error" }> = {
  COMPLETED: { label: "Concluído", variant: "green" },
  PENDING: { label: "Pendente", variant: "warning" },
  FAILED: { label: "Falhou", variant: "error" },
};

const FILTERS = [
  { key: "all", label: "Tudo" },
  { key: "DEPOSIT", label: "Depósitos" },
  { key: "WITHDRAW", label: "Saques" },
  { key: "BONUS", label: "Bônus" },
  { key: "CASHBACK", label: "Cashback" },
  { key: "COMMISSION", label: "Comissões" },
];

export function TransactionsList() {
  const { data, isLoading } = useTransactionsList();
  const [filter, setFilter] = useState("all");

  const items = useMemo(() => {
    const all = data?.transactions ?? [];
    if (filter === "all") return all;
    return all.filter((t) => t.type === filter);
  }, [data, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
              filter === f.key
                ? "border-purple bg-purple/15 text-purple"
                : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-2 text-center">
          <Inbox className="size-7 text-text-muted" />
          <p className="text-sm text-text-secondary">Nenhuma movimentação encontrada</p>
        </Card>
      ) : (
        <Card className="p-2 md:p-3">
          <div className="flex flex-col">
            {items.map((t) => {
              const meta = TYPE_META[t.type] ?? {
                label: t.type,
                icon: Coins,
                tone: "text-text-secondary",
                sign: "+" as const,
              };
              const status = STATUS_META[t.status] ?? { label: t.status, variant: "green" as const };
              const d = new Date(t.createdAt);
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05]",
                        meta.tone
                      )}
                    >
                      <meta.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{meta.label}</p>
                      <p className="text-xs text-text-muted tabular-nums">
                        {d.toLocaleDateString("pt-BR")} ·{" "}
                        {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn("text-sm font-bold tabular-nums", meta.tone)}>
                      {meta.sign}
                      {formatCurrency(centsToReais(t.amount))}
                    </span>
                    <Badge variant={status.variant} size="sm">
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
