import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { paymentsContainer } from "@/modules/payments/container";
import { centsToReais } from "@/lib/multiplier";

/**
 * Read-only deposit/withdraw limits, driven by the same PaymentSettings the
 * admin "Limites financeiros" screen edits (src/app/admin/settings) — mirrors
 * src/app/api/config/route.ts's "backend-controlled, frontend only renders"
 * pattern. Player-facing deposit/withdraw panels use this instead of
 * hardcoding a minimum, so an admin-configured limit actually takes effect.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const settings = await paymentsContainer.paymentService.getSettings();

  return NextResponse.json({
    depositMin: centsToReais(settings.depositMinCents),
    depositMax: centsToReais(settings.depositMaxCents),
    withdrawMin: centsToReais(settings.withdrawMinCents),
    withdrawMax: centsToReais(settings.withdrawMaxCents),
  });
}
