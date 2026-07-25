"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAffiliateProfile } from "@/hooks/use-affiliate";
import { AffiliateApplyForm } from "@/components/referrals/affiliate/apply-form";
import { AffiliateStatusCard } from "@/components/referrals/affiliate/status-card";
import { AffiliateDashboard } from "@/components/referrals/affiliate/dashboard";

/**
 * The "Indique" tab's content — the platform's ONE affiliate entry point,
 * always visible to every logged-in player (see AGENTS.md's "Painel do
 * Afiliado Integrado"). Content branches purely on AffiliateProfile's state:
 * no profile → apply; PENDING/DOCUMENTS_REQUESTED/REJECTED/BLOCKED → status
 * card; APPROVED → full dashboard. Never a different flow for "fluxo
 * orgânico" vs. "fluxo via convite" — only the resulting sponsor/commission
 * differs, entirely server-side.
 */
export function AffiliatePanel({ prefillManagerCode }: { prefillManagerCode?: string }) {
  const { data: profile, isLoading } = useAffiliateProfile();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) return <AffiliateApplyForm prefillManagerCode={prefillManagerCode} />;
  if (profile.status === "APPROVED") return <AffiliateDashboard profile={profile} />;
  return <AffiliateStatusCard profile={profile} />;
}
