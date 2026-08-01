"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AffiliatePanel } from "@/components/referrals/affiliate/affiliate-panel";

/**
 * "Indique" — the platform's ONE and only affiliate entry point, always
 * visible to every logged-in player (every account is auto-enrolled as an
 * approved affiliate at signup — see AffiliateService.autoEnroll, no
 * request/approval step). `?manager=CODE` arrives from
 * /affiliate-invite/[code]/route.ts's redirect and is used for first-touch
 * manager attribution (see AffiliateDashboard) instead of prefilling an
 * apply form. The header/description live inside AffiliatePanel's dashboard
 * now, not here, so there's a single source for that copy.
 */
function ReferralsScreenInner() {
  const searchParams = useSearchParams();
  const managerCode = searchParams.get("manager") ?? undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <AffiliatePanel prefillManagerCode={managerCode} />
    </div>
  );
}

export function ReferralsScreen() {
  return (
    <Suspense fallback={null}>
      <ReferralsScreenInner />
    </Suspense>
  );
}
