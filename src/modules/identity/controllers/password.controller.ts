import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import {
  changePasswordSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "@/modules/identity/validators/password.validator";
import { identityContainer } from "@/modules/identity/container";

const { passwordService } = identityContainer;

export async function handleChangePassword(req: NextRequest, auth: AuthContext) {
  const body = changePasswordSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await passwordService.changePassword(auth.userId, body, meta);
  return ok({});
}

export async function handleRequestPasswordReset(req: NextRequest) {
  const body = requestPasswordResetSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await passwordService.requestReset(body.email, meta);
  // Always the same response — never reveal whether the email exists.
  return ok({});
}

export async function handleConfirmPasswordReset(req: NextRequest) {
  const body = confirmPasswordResetSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await passwordService.confirmReset(body, meta);
  return ok({});
}
