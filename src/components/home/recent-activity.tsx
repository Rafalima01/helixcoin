"use client";

import {
  AlertTriangle,
  Inbox,
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/use-wallet";
import { centsToReais } from "@/lib/multiplier";
import { formatCurrency, formatMultiplier } from "@/lib/utils";

export function RecentActivity() {
  const { data, isLoading, isError, refetch } = useWallet();

  return (
    <Card className="p-6">
      <h3 className="font-bold text-lg mb-4">Atividade recente</h3>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <AlertTriangle className="size-6 text-error" />
          <p className="text-sm text-text-secondary">Não foi possível carregar sua atividade</p>
          <button
            onClick={() => refetch()}
            className="text-xs text-purple font-semibold hover:text-pink"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!isLoading && !isError && (data?.recentMatches.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Inbox className="size-7 text-text-muted" />
          <p className="text-sm text-text-secondary">Você ainda não jogou nenhuma partida</p>
          <p className="text-xs text-text-muted">Deposite e jogue para ver seu histórico aqui.</p>
        </div>
      )}

      {!isLoading && !isError && (data?.recentMatches.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1">
          {data!.recentMatches.map((m) => {
            const won = m.status === "CASHED_OUT";
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={
                      won
                        ? "flex size-9 items-center justify-center rounded-full bg-green/15 text-green"
                        : "flex size-9 items-center justify-center rounded-full bg-error/15 text-error"
                    }
                  >
                    {won ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {won ? "Resgatou" : "Perdeu"} · {m.platformsPassed} plataformas
                    </p>
                    <p className="text-xs text-text-muted">
                      Aposta {formatCurrency(centsToReais(m.betAmount))}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={won ? "font-bold text-green" : "font-bold text-error"}>
                    {won ? "+" : "-"}
                    {formatCurrency(centsToReais(won ? (m.payout ?? 0) : m.betAmount))}
                  </p>
                  <Badge variant={won ? "green" : "error"} size="sm">
                    {formatMultiplier(m.multiplier)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && (data?.recentTransactions.length ?? 0) > 0 && (
        <>
          <div className="h-px bg-border my-4" />
          <div className="flex flex-col gap-1">
            {data!.recentTransactions.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-3">
                  {t.type === "DEPOSIT" ? (
                    <ArrowDownToLine className="size-4 text-green" />
                  ) : t.type === "WITHDRAW" ? (
                    <ArrowUpFromLine className="size-4 text-pink" />
                  ) : (
                    <TrendingUp className="size-4 text-purple" />
                  )}
                  <span className="text-sm text-text-secondary">
                    {t.type === "DEPOSIT" ? "Depósito" : t.type === "WITHDRAW" ? "Saque" : t.type}
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(centsToReais(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
