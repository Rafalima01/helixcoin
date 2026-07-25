"use client";

import { useState } from "react";
import { Copy, Check, Users, TrendingUp, MousePointerClick, Wallet, Link2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PseudoQr } from "@/components/wallet/pseudo-qr";
import { useWallet } from "@/hooks/use-wallet";
import { useAffiliateDashboard, useAffiliateCommissions } from "@/hooks/use-affiliate";
import { formatCurrency } from "@/lib/utils";
import { centsToReais } from "@/lib/multiplier";
import type { AffiliateMyProfileDto } from "@/modules/affiliate/dto/affiliate.dto";

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "text-green",
  LOCKED: "text-warning",
  REJECTED: "text-error",
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  LOCKED: "Bloqueada",
  REJECTED: "Rejeitada",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-text-muted truncate">{label}</p>
        <p className="text-sm font-bold truncate">{value}</p>
      </div>
    </Card>
  );
}

function CopyLinkRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <button
        onClick={handleCopy}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-black/30 px-4 py-3 text-left w-full"
      >
        <p className="text-xs text-text-secondary truncate">{url}</p>
        {copied ? <Check className="size-4 text-green shrink-0" /> : <Copy className="size-4 text-text-muted shrink-0" />}
      </button>
    </div>
  );
}

export function AffiliateDashboard({ profile }: { profile: AffiliateMyProfileDto }) {
  const { data: wallet } = useWallet();
  const { data: stats, isLoading: statsLoading } = useAffiliateDashboard();
  const { data: commissions, isLoading: commissionsLoading } = useAffiliateCommissions();

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralCode = wallet?.user?.referralCode ?? "";
  const directLink = referralCode ? `${origin}/r/${referralCode}` : "";
  const subAffiliateLink = profile.managerId && profile.canInviteAffiliates && profile.managerInviteCode
    ? `${origin}/affiliate-invite/${profile.managerInviteCode}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Resumo */}
      <div>
        <h2 className="text-lg font-bold mb-3">Resumo</h2>
        {statsLoading || !stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <StatCard label="Minha comissão" value={`${profile.resolvedCommissionPercent}%`} icon={TrendingUp} />
            <StatCard label="Total gerado" value={formatCurrency(centsToReais(stats.commissionTotalCents))} icon={Wallet} />
            <StatCard label="Comissão disponível" value={formatCurrency(centsToReais(stats.balanceAvailableCents))} icon={Wallet} />
            <StatCard label="Jogadores indicados" value={String(stats.referredCount)} icon={Users} />
            <StatCard label="Depósitos confirmados" value={String(stats.confirmedDeposits)} icon={TrendingUp} />
            <StatCard label="Conversão" value={`${stats.conversionPercent}%`} icon={TrendingUp} />
            <StatCard label="Cliques nos links" value={String(stats.linkClicks)} icon={MousePointerClick} />
          </div>
        )}
      </div>

      {/* Links */}
      <div>
        <h2 className="text-lg font-bold mb-3">Links</h2>
        <Card className="p-5 flex flex-col md:flex-row gap-5">
          <div className="flex-1 flex flex-col justify-center gap-4">
            <CopyLinkRow label="Link direto" url={directLink} />
            {subAffiliateLink && (
              <CopyLinkRow label="Link de convite para afiliados" url={subAffiliateLink} />
            )}
          </div>
          {directLink && (
            <div className="flex flex-col items-center gap-2 shrink-0">
              <PseudoQr data={directLink} size={140} />
              <p className="text-[11px] text-text-muted">QR Code</p>
            </div>
          )}
        </Card>
      </div>

      {/* Subafiliados */}
      {profile.managerId && profile.canInviteAffiliates && (
        <div>
          <h2 className="text-lg font-bold mb-3">Subafiliados</h2>
          <Card className="p-5 flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
              <UserPlus className="size-4" />
            </span>
            <p className="text-sm text-text-secondary">
              Compartilhe o link acima para recrutar novos afiliados — eles ficam vinculados ao mesmo gerente que você.
            </p>
          </Card>
        </div>
      )}

      {/* Histórico */}
      <div>
        <h2 className="text-lg font-bold mb-3">Histórico</h2>
        {commissionsLoading ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        ) : !commissions?.data || commissions.data.length === 0 ? (
          <Card className="p-10 flex flex-col items-center gap-3 text-center">
            <Link2 className="size-8 text-text-muted" />
            <p className="font-semibold">Nenhuma comissão ainda</p>
            <p className="text-sm text-text-secondary max-w-sm">
              Compartilhe seu link direto para começar a receber comissões.
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Jogador</th>
                  <th className="px-4 py-3 font-semibold">Depósito</th>
                  <th className="px-4 py-3 font-semibold">%</th>
                  <th className="px-4 py-3 font-semibold">Comissão</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.data.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 truncate">{c.playerName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                      {c.depositAmountCents !== null ? formatCurrency(centsToReais(c.depositAmountCents)) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                      {c.percentApplied !== null ? `${Math.round(c.percentApplied * 1000) / 10}%` : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">
                      {formatCurrency(centsToReais(c.amountCents))}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap font-semibold ${STATUS_BADGE[c.status] ?? ""}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
