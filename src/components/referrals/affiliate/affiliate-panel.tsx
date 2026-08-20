"use client";

import { AffiliateDashboard } from "@/components/referrals/affiliate/dashboard";

/**
 * The "Indique" tab's content — the platform's ONE affiliate entry point,
 * visible to and usable by EVERY logged-in player, whether or not an admin
 * ever promoted them to AffiliateProfile ("Transformar em afiliado", see
 * src/app/admin/users/page.tsx). Referral identity (User.referralCode/
 * referredById, set at signup) has always been independent of
 * AffiliateProfile — see AffiliateDashboardDto's doc comment for the full
 * split. AffiliateDashboard is entirely driven by useAffiliateDashboard()
 * now (no more `profile` prop, no more gating on it existing), which never
 * 404s for a regular account — see handleGetAffiliateDashboard.
 */
export function AffiliatePanel({ prefillManagerCode }: { prefillManagerCode?: string }) {
  return <AffiliateDashboard managerCode={prefillManagerCode} />;
}
