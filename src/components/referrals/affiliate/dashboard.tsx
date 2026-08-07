"use client";

import { useEffect, useRef, useState } from "react";
import {
  PercentIcon as Percent,
  UsersIcon as Users,
  HandshakeIcon as Handshake,
  CoinsIcon as Coins,
  TrophyIcon as Trophy,
  ClockIcon as Clock,
  ArrowLineUpIcon as ArrowLineUp,
  CopyIcon as Copy,
  CheckIcon as Check,
  ShareNetworkIcon as ShareNetwork,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  ShieldCheckIcon as ShieldCheck,
  GiftIcon as Gift,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PixKeyWithdrawModal } from "@/components/commercial/pix-key-withdraw-modal";
import { useWallet } from "@/hooks/use-wallet";
import { useAffiliateDashboard, useAssignAffiliateManager } from "@/hooks/use-affiliate";
import { formatCurrency, cn } from "@/lib/utils";
import { centsToReais } from "@/lib/multiplier";
import type { AffiliateMyProfileDto } from "@/modules/affiliate/dto/affiliate.dto";

const STEPS = [
  {
    title: "Compartilhe seu link",
    description: "Envie pelo WhatsApp, Telegram, Instagram ou qualquer rede social.",
  },
  {
    title: "Seus amigos se cadastram",
    description: "Quando criarem uma conta utilizando seu link, ficam vinculados automaticamente.",
  },
  {
    title: "Ganhe recompensas",
    description: "Receba comissão conforme seus indicados realizarem depósitos e continuarem ativos.",
  },
];

const HIGHLIGHTS = [
  { icon: ShareNetwork, tone: "purple" as const, title: "Compartilhe", description: "Compartilhe seu link facilmente." },
  {
    icon: ShieldCheck,
    tone: "cool" as const,
    title: "Fluxo Seguro",
    description: "Sistema de rastreamento automático das indicações.",
  },
  { icon: Gift, tone: "gold" as const, title: "Reward Combo", description: "Receba recompensas conforme sua rede cresce." },
];

const TONE_CLASSES: Record<"purple" | "cool" | "gold", string> = {
  purple: "bg-purple/15 text-purple",
  cool: "bg-accent-cool/15 text-accent-cool",
  gold: "bg-gold/15 text-gold",
};

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  loading,
}: {
  icon: typeof Users;
  tone: "purple" | "cool" | "gold" | "green";
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          tone === "green" ? "bg-green/15 text-green" : TONE_CLASSES[tone]
        )}
      >
        <Icon className="size-[18px]" weight="duotone" />
      </span>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="font-display text-xl md:text-2xl font-extrabold tabular-nums">{value}</p>
      )}
      <p className="text-xs text-text-secondary leading-tight">{label}</p>
    </Card>
  );
}

function CopyLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Indique o HeliJump", url });
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      await handleCopy();
    }
  };

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
          <PaperPlaneTilt className="size-5" weight="duotone" />
        </span>
        <div>
          <p className="font-bold text-base leading-tight">Seu Link de Indicação</p>
          <p className="text-xs text-text-secondary">Compartilhe com seus amigos para ganharem juntos</p>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] border border-border bg-black/30 px-4 py-3 text-left"
      >
        <p className="text-xs md:text-sm text-text-secondary truncate">{url}</p>
        {copied ? (
          <Check className="size-4 text-green shrink-0" weight="duotone" />
        ) : (
          <Copy className="size-4 text-text-muted shrink-0" weight="duotone" />
        )}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="size-4" weight="duotone" /> Copiar
        </Button>
        <Button variant="gold" onClick={handleShare}>
          <ShareNetwork className="size-4" weight="duotone" /> Compartilhar
        </Button>
      </div>
    </Card>
  );
}

export function AffiliateDashboard({
  profile,
  managerCode,
}: {
  profile: AffiliateMyProfileDto;
  managerCode?: string;
}) {
  const { data: wallet } = useWallet();
  const { data: stats, isLoading: statsLoading } = useAffiliateDashboard();
  const { mutate: assignManager } = useAssignAffiliateManager();
  const attemptedManagerAssign = useRef(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // First-touch attribution for someone who arrived via a Manager's
  // "Convidar Afiliados" link — see AffiliateService.assignManagerIfUnset.
  // Only fires once, and only if there's no manager attached yet.
  useEffect(() => {
    if (managerCode && !profile.managerId && !attemptedManagerAssign.current) {
      attemptedManagerAssign.current = true;
      assignManager(managerCode);
    }
  }, [managerCode, profile.managerId, assignManager]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralCode = wallet?.user?.referralCode ?? "";
  const directLink = referralCode ? `${origin}/r/${referralCode}` : "";

  const availableCents = stats?.balanceAvailableCents ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Indique e <span className="text-gradient-brand">Ganhe</span>
          </h1>
          {referralCode && (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold tabular-nums">
              Seu código: {referralCode}
            </span>
          )}
        </div>
        <p className="text-text-secondary mt-2 max-w-xl leading-relaxed mx-auto sm:mx-0">
          Convide seus amigos para jogarem no HeliJump! Quanto mais amigos, mais recompensas.
        </p>
      </div>

      {/* Stats — 4 metrics of equal weight, not the point (see the Comissões card below for the number that matters). */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={Percent}
          tone="gold"
          label="Comissão"
          value={`${profile.resolvedCommissionPercent}%`}
          loading={false}
        />
        <StatTile
          icon={Users}
          tone="purple"
          label="Indicações"
          value={String(stats?.referredCount ?? 0)}
          loading={statsLoading}
        />
        <StatTile
          icon={Handshake}
          tone="cool"
          label="FTDs"
          value={String(stats?.confirmedDeposits ?? 0)}
          loading={statsLoading}
        />
        <StatTile
          icon={Coins}
          tone="green"
          label="Total Depositado"
          value={formatCurrency(centsToReais(stats?.referredDepositTotalCents ?? 0))}
          loading={statsLoading}
        />
      </div>

      {/* Comissões */}
      <Card variant="hero-number" className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gold/15 text-gold">
              <Trophy className="size-4" weight="duotone" />
            </span>
            {statsLoading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <p className="font-display text-xl md:text-2xl font-extrabold text-gradient-gold tabular-nums">
                {formatCurrency(centsToReais(stats?.commissionTotalCents ?? 0))}
              </p>
            )}
            <p className="text-xs text-text-secondary">Comissões ganhas</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <Clock className="size-4" weight="duotone" />
            </span>
            {statsLoading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <p className="font-display text-xl md:text-2xl font-extrabold tabular-nums">
                {formatCurrency(centsToReais(stats?.balanceLockedCents ?? 0))}
              </p>
            )}
            <p className="text-xs text-text-secondary">Comissões pendentes</p>
          </div>
        </div>

        {availableCents > 0 ? (
          <Button variant="gold" size="lg" className="w-full" onClick={() => setWithdrawModalOpen(true)}>
            <ArrowLineUp className="size-4" weight="duotone" /> Resgatar
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button variant="gold" size="lg" className="w-full" disabled>
              <ArrowLineUp className="size-4" weight="duotone" /> Resgatar
            </Button>
            <p className="text-[11px] text-text-muted text-center">
              Você ainda não tem comissões disponíveis para saque.
            </p>
          </div>
        )}
      </Card>

      {/* Link */}
      <CopyLinkCard url={directLink} />

      {/* Como Funciona */}
      <div>
        <h2 className="text-lg font-bold mb-3">Como Funciona</h2>
        <div className="flex flex-col gap-2.5">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="flex items-start gap-4 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple to-pink font-display text-sm font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-bold text-sm">{step.title}</p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{step.description}</p>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted leading-relaxed">
          <span className="font-semibold text-text-secondary">Dica:</span> quanto mais amigos você convidar, melhores
          serão suas recompensas.
        </p>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-3 gap-3">
        {HIGHLIGHTS.map((h) => (
          <Card key={h.title} className="flex flex-col items-center gap-2 p-4 text-center">
            <span className={cn("flex size-10 items-center justify-center rounded-2xl", TONE_CLASSES[h.tone])}>
              <h.icon className="size-5" weight="duotone" />
            </span>
            <p className="font-bold text-sm">{h.title}</p>
            <p className="text-[11px] text-text-secondary leading-tight">{h.description}</p>
          </Card>
        ))}
      </div>

      <PixKeyWithdrawModal open={withdrawModalOpen} onClose={() => setWithdrawModalOpen(false)} role="AFFILIATE" />
    </div>
  );
}
