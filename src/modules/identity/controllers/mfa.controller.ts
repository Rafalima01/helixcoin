import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { identityContainer } from "@/modules/identity/container";

const { mfaService } = identityContainer;

export async function handleGetMfaStatus(_req: NextRequest, auth: AuthContext) {
  const status = await mfaService.getStatus(auth.userId);
  return ok(status);
}
