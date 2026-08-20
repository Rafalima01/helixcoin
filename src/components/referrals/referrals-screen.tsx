"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AffiliatePanel } from "@/components/referrals/affiliate/affiliate-panel";

/**
 * "Indique" — the platform's ONE and only affiliate entry point, visible to
 * AND usable by every logged-in player. Referral identity (referral link/
 * code, referredCount, default 5% commission) is independent of
 * AffiliateProfile — an admin promoting the account via "Transformar em
 * afiliado" (src/app/admin/users/page.tsx) only adds administrative
 * management (appears in the Afiliados tab, can be assigned a manager/
 * custom commission), it is never a prerequisite for this screen. See
 * AffiliateDashboardDto's doc comment for the full split. `?manager=CODE`
 * arrives from /affiliate-invite/[code]/route.ts's redirect and is used for
 * first-touch manager attribution (see AffiliateDashboard) instead of
 * prefilling an apply form. The header/description live inside
 * AffiliatePanel's dashboard now, not here, so there's a single source for
 * that copy.
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
