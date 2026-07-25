import type { NextRequest } from "next/server";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { ledgerContainer } from "@/modules/ledger/container";
import { adminLedgerListQuerySchema } from "@/modules/ledger/validators/ledger.validator";
import { toLedgerEntryDto } from "@/modules/ledger/dto/ledger.dto";

const { ledgerService } = ledgerContainer;
const { permissionService } = identityContainer;

/** Ledger is read-only everywhere — this permission gate is the only thing guarding these two GET routes; there is no POST/PATCH/DELETE route for ledger anywhere in the API. */
async function assertLedgerReadPermission(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "ledger.read"))) {
    throw new ForbiddenError();
  }
}

export async function handleListLedgerAdmin(req: NextRequest, auth: AuthContext) {
  await assertLedgerReadPermission(auth);

  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminLedgerListQuerySchema.parse({
    debitAccount: url.searchParams.get("debitAccount") ?? undefined,
    creditAccount: url.searchParams.get("creditAccount") ?? undefined,
    reference: url.searchParams.get("reference") ?? undefined,
    referenceType: url.searchParams.get("referenceType") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await ledgerService.list({
    debitAccount: query.debitAccount,
    creditAccount: query.creditAccount,
    reference: query.reference,
    referenceType: query.referenceType,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toLedgerEntryDto), buildPaginationMeta(pagination, total));
}

export async function handleGetLedgerEntryAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertLedgerReadPermission(auth);
  const entry = await ledgerService.getById(id);
  if (!entry) throw new NotFoundError("Lançamento");
  return ok(toLedgerEntryDto(entry));
}
