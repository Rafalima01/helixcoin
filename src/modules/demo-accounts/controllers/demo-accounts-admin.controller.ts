import type { NextRequest } from "next/server";
import { ok, created } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { demoAccountsContainer } from "@/modules/demo-accounts/container";
import {
  createDemoAccountSchema,
  addDemoBalanceSchema,
  setDemoFlagSchema,
} from "@/modules/demo-accounts/validators/demo-account.validator";
import { toDemoAccountListItemDto } from "@/modules/demo-accounts/dto/demo-account.dto";

const { demoAccountService } = demoAccountsContainer;
const { permissionService } = identityContainer;

async function assertPermission(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "demo.accounts.manage"))) {
    throw new ForbiddenError();
  }
}

export async function handleListDemoAccounts(_req: NextRequest, auth: AuthContext) {
  await assertPermission(auth);
  const rows = await demoAccountService.list();
  return ok(rows.map(toDemoAccountListItemDto));
}

export async function handleCreateDemoAccount(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth);
  const body = createDemoAccountSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const result = await demoAccountService.create(
    body.initialBalanceCents,
    { id: auth.userId, role: auth.role! },
    meta
  );
  return created(result);
}

export async function handleAddDemoBalance(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth);
  const body = addDemoBalanceSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await demoAccountService.addBalance(userId, body.amountCents, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}

export async function handleZeroDemoBalance(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth);
  const meta = extractRequestMeta(req);
  await demoAccountService.zeroBalance(userId, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}

export async function handleDeactivateDemoAccount(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth);
  const meta = extractRequestMeta(req);
  await demoAccountService.deactivate(userId, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}

/**
 * Flips an existing player account between demo and real. Separate from
 * create/deactivate because it targets a user that already exists outside the
 * demo flow — the service refuses accounts with real financial history.
 */
export async function handleSetUserDemoFlag(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth);
  const body = setDemoFlagSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await demoAccountService.setDemoFlag(userId, body.isDemo, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}
