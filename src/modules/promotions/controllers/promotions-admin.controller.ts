import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
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
  const settings = await promotionsService.updateSettings(body);
  return ok(toPromotionSettingsDto(settings));
}
