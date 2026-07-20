"use client";

import { useState } from "react";
import Link from "next/link";
import { User, ShieldCheck, Monitor, Receipt, Gamepad2, Gift, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { AccountStats } from "@/components/profile/account-stats";
import { SecuritySection } from "@/components/profile/security-section";
import { SessionsSection } from "@/components/profile/sessions-section";
import { TransactionsList } from "@/components/profile/transactions-list";
import { GameHistory } from "@/components/profile/game-history";
import { cn } from "@/lib/utils";

type TabKey = "conta" | "seguranca" | "sessoes" | "transacoes" | "historico" | "afiliados";

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: "conta", label: "Conta", icon: User },
  { key: "seguranca", label: "Segurança", icon: ShieldCheck },
  { key: "sessoes", label: "Sessões", icon: Monitor },
  { key: "transacoes", label: "Transações", icon: Receipt },
  { key: "historico", label: "Histórico de jogo", icon: Gamepad2 },
  { key: "afiliados", label: "Afiliados", icon: Gift },
];

function AffiliateCard() {
  return (
    <Card
      glow="purple"
      className="p-6 md:p-8 bg-gradient-to-br from-purple/15 via-transparent to-pink/10"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white">
          <Gift className="size-6" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg mb-1 flex items-center gap-2">
            Programa de Afiliados
            <Sparkles className="size-4 text-warning" />
          </p>
          <p className="text-sm text-text-secondary leading-relaxed max-w-lg">
            Convide amigos com seus links exclusivos de três níveis e receba comissões conforme eles
            se tornam jogadores ativos e realizam depósitos.
          </p>
        </div>
        <Link href="/referrals" className="shrink-0">
          <Button variant="primary" size="lg">
            Ir para Indicações
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export function ProfileScreen() {
  const { data, isLoading } = useWallet();
  const [tab, setTab] = useState<TabKey>("conta");

  const name = data?.user?.name ?? "Jogador";
  const email = data?.user?.email ?? "";
  const level = data?.user?.level ?? 1;
  const xp = data?.user?.xp ?? 0;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <Card className="p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 size-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-4 md:gap-5">
          <span className="flex size-16 md:size-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-2xl md:text-3xl font-extrabold">
            {initial}
          </span>
          <div className="min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-40 mb-2" />
                <Skeleton className="h-4 w-56" />
              </>
            ) : (
              <>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight truncate">
                  {name}
                </h1>
                <p className="text-sm text-text-secondary truncate">{email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-purple/15 border border-purple/25 px-2.5 py-0.5 text-[11px] font-bold text-purple">
                    Nível {level}
                  </span>
                  <span className="text-[11px] text-text-muted">{xp} XP</span>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Tab nav */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
              tab === t.key
                ? "border-purple bg-purple/15 text-purple shadow-[0_0_18px_rgba(139,92,246,0.25)]"
                : "border-border bg-white/[0.02] text-text-secondary hover:border-border-strong hover:text-white"
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "conta" && <AccountStats />}
      {tab === "seguranca" && <SecuritySection email={email} />}
      {tab === "sessoes" && <SessionsSection />}
      {tab === "transacoes" && <TransactionsList />}
      {tab === "historico" && <GameHistory />}
      {tab === "afiliados" && <AffiliateCard />}
    </div>
  );
}
