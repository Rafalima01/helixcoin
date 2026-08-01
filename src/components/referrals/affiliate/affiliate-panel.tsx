"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAffiliateProfile } from "@/hooks/use-affiliate";
import { AffiliateDashboard } from "@/components/referrals/affiliate/dashboard";

/**
 * The "Indique" tab's content — the platform's ONE affiliate entry point,
 * always visible to every logged-in player. Every account is auto-enrolled
 * as an approved affiliate at signup (see AffiliateService.autoEnroll), so
 * there is no request/approval branch here anymore — just a loading state
 * while the profile loads, then straight to the dashboard.
 */
export function AffiliatePanel({ prefillManagerCode }: { prefillManagerCode?: string }) {
  const { data: profile, isLoading } = useAffiliateProfile();

  if (isLoading || !profile) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return <AffiliateDashboard profile={profile} managerCode={prefillManagerCode} />;
}
