import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { paymentsContainer } from "@/modules/payments/container";
import { promotionsContainer } from "@/modules/promotions/container";
import { promotionSettingsUpdateSchema } from "@/modules/promotions/validators/promotions.validator";
import { toPromotionSettingsDto } from "@/modules/promotions/dto/promotions.dto";

const { promotionsService } = promotionsContainer;
const { permissionService } = identityContainer;

async function assertPermission(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "promotions.settings.manage"))) {
    throw new ForbiddenError();
  }
}

export async function handleGetPromotionSettingsAdmin(_req: NextRequest, auth: AuthContext) {
  await assertPermission(auth);
  const settings = await promotionsService.getSettings();
  return ok(toPromotionSettingsDto(settings));
}

export async function handleUpdatePromotionSettingsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth);
  const body = promotionSettingsUpdateSchema.parse(await req.json());

  // Cross-module business rule: each quick amount must sit inside the real
  // deposit limits PaymentSettings already enforces server-side (never
  // duplicated/hardcoded here — read fresh on every save). Lives at the
  // controller boundary rather than inside PromotionsService to avoid a
  // promotions↔payments container import cycle (payments/container.ts
  // already imports promotions/container.ts for the deposit-confirmed
  // subscription wiring).
  if (body.depositQuickAmounts) {
    const paymentSettings = await paymentsContainer.paymentService.getSettings();
    const outOfRange = body.depositQuickAmounts.filter(
      (a) => a.amountCents < paymentSettings.depositMinCents || a.amountCents > paymentSettings.depositMaxCents
    );
    if (outOfRange.length > 0) {
      throw new ValidationError(
        `Valores rápidos devem estar entre ${(paymentSettings.depositMinCents / 100).toFixed(2)} e ${(paymentSettings.depositMaxCents / 100).toFixed(2)} (limites de depósito atuais)`
      );
    }
  }

  const settings = await promotionsService.updateSettings(body);
  return ok(toPromotionSettingsDto(settings));
}
