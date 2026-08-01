import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { promotionsContainer } from "@/modules/promotions/container";
import { toDepositOfferDto } from "@/modules/promotions/dto/promotions.dto";

const { promotionsService } = promotionsContainer;

/** GET /api/promotions/deposit-offer — any authenticated player. Read-only, backend-controlled, mirrors src/app/api/payments/limits/route.ts's convention. */
export async function handleGetDepositOffer(_req: NextRequest, _auth: AuthContext) {
  const settings = await promotionsService.getSettings();
  return ok(toDepositOfferDto(settings));
}
