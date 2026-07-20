import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { confirmEmailVerificationSchema } from "@/modules/identity/validators/email-verification.validator";
import { identityContainer } from "@/modules/identity/container";

const { emailVerificationService } = identityContainer;

export async function handleRequestEmailVerification(req: NextRequest, auth: AuthContext) {
  const meta = extractRequestMeta(req);
  await emailVerificationService.requestVerification(auth.userId, meta);
  return ok({});
}

export async function handleConfirmEmailVerification(req: NextRequest) {
  const body = confirmEmailVerificationSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await emailVerificationService.confirmVerification(body, meta);
  return ok({});
}
