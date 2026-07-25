import type { NextRequest } from "next/server";
import type { TransactionType, TransactionStatus } from "@prisma/client";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { walletContainer } from "@/modules/wallet/container";
import {
  adminWalletListQuerySchema,
  adminTransactionListQuerySchema,
  adminAdjustSchema,
} from "@/modules/wallet/validators/wallet.validator";
import {
  toWalletBalancesDto,
  toWalletTransactionDto,
  toWalletAdminSummaryDto,
} from "@/modules/wallet/dto/wallet.dto";

const { walletService } = walletContainer;
const { permissionService } = identityContainer;

async function assertPermission(auth: AuthContext, key: "wallet.read" | "wallet.update"): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

export async function handleListWalletsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "wallet.read");

  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminWalletListQuerySchema.parse({ search: url.searchParams.get("search") ?? undefined });

  const { items, total } = await walletService.listWalletsAdmin({
    search: query.search,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toWalletAdminSummaryDto), buildPaginationMeta(pagination, total));
}

export async function handleGetWalletAdmin(_req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "wallet.read");

  const [balances, recent] = await Promise.all([
    walletService.getBalance(userId),
    walletService.listTransactions({ userId, page: 1, pageSize: 20 }),
  ]);

  return ok({
    balances: toWalletBalancesDto(balances),
    recentTransactions: recent.items.map(toWalletTransactionDto),
  });
}

export async function handleAdjustWallet(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "wallet.update");

  const body = adminAdjustSchema.parse(await req.json());
  const { ip, userAgent } = extractRequestMeta(req);

  const result = await walletService.adjust({
    userId,
    amountCents: body.amount,
    account: body.account,
    reason: body.reason,
    observation: body.observation,
    idempotencyKey: crypto.randomUUID(),
    actor: { actorId: auth.userId, actorType: "ADMIN", actorRole: auth.role ?? null, ip, userAgent },
  });

  return ok({
    balances: toWalletBalancesDto(result.balanceAfter),
    transaction: toWalletTransactionDto(result.transaction),
  });
}

export async function handleListTransactionsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "wallet.read");

  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminTransactionListQuerySchema.parse({
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    origin: url.searchParams.get("origin") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    minAmount: url.searchParams.get("minAmount") ?? undefined,
    maxAmount: url.searchParams.get("maxAmount") ?? undefined,
  });

  const { items, total } = await walletService.listTransactions({
    type: query.type as TransactionType | undefined,
    status: query.status as TransactionStatus | undefined,
    userId: query.userId,
    origin: query.origin,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    minAmount: query.minAmount,
    maxAmount: query.maxAmount,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toWalletTransactionDto), buildPaginationMeta(pagination, total));
}

export async function handleGetTransactionAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "wallet.read");
  const tx = await walletService.getTransactionById(id);
  if (!tx) throw new NotFoundError("Transação");
  return ok(toWalletTransactionDto(tx));
}
