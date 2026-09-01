import type { NextRequest } from "next/server";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { paymentsContainer } from "@/modules/payments/container";
import {
  adminDepositListQuerySchema,
  adminWithdrawListQuerySchema,
  adminWithdrawDecisionSchema,
  adminGatewayListQuerySchema,
  adminWebhookListQuerySchema,
  adminGatewayLogListQuerySchema,
  gatewayCredentialCreateSchema,
  gatewayCredentialUpdateSchema,
  paymentSettingsUpdateSchema,
  adminSimulateDepositSchema,
} from "@/modules/payments/validators/payments.validator";
import {
  toDepositAdminDto,
  toWithdrawAdminDto,
  toGatewayCredentialAdminDto,
  toPaymentWebhookAdminDto,
  toGatewayLogAdminDto,
  toPaymentSettingsDto,
} from "@/modules/payments/dto/payments.dto";
import type { DepositStatus, WithdrawStatus, WebhookStatus, GatewayProvider, PaymentRelatedType } from "@/modules/payments/entities/payments.entity";

const { paymentService } = paymentsContainer;
const { permissionService } = identityContainer;

type PaymentPermission =
  | "payments.deposits.read"
  | "payments.withdrawals.read"
  | "payments.withdrawals.approve"
  | "payments.gateways.read"
  | "payments.gateways.manage"
  | "payments.webhooks.read"
  | "payments.webhooks.manage"
  | "payments.logs.read";

async function assertPermission(auth: AuthContext, key: PaymentPermission): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

function dateOrUndefined(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

// ------------------------------------------------------------- deposits

export async function handleListDepositsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.deposits.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminDepositListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    gatewayCredentialId: url.searchParams.get("gatewayCredentialId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await paymentService.listDepositsAdmin({
    status: query.status as DepositStatus | undefined,
    gatewayCredentialId: query.gatewayCredentialId,
    userId: query.userId,
    from: dateOrUndefined(query.from),
    to: dateOrUndefined(query.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toDepositAdminDto), buildPaginationMeta(pagination, total));
}

export async function handleGetDepositAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.deposits.read");
  const deposit = await paymentService.getDepositAdmin(id);
  return ok(deposit);
}

/** Fase 10 admin simulator — broader outcome set (CANCELLED/EXPIRED/REFUNDED) than the player-facing /api/payments/deposits/{id}/simulate, MOCK-only (enforced in PaymentService.simulateDepositAdmin). */
export async function handleSimulateDepositAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.gateways.manage");
  const body = adminSimulateDepositSchema.parse(await req.json());
  const result = await paymentService.simulateDepositAdmin(id, body.outcome);
  return ok(result);
}

// ------------------------------------------------------------ withdrawals

export async function handleListWithdrawalsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.withdrawals.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminWithdrawListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    gatewayCredentialId: url.searchParams.get("gatewayCredentialId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    simulated: url.searchParams.get("simulated") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await paymentService.listWithdrawsAdmin({
    status: query.status as WithdrawStatus | undefined,
    gatewayCredentialId: query.gatewayCredentialId,
    userId: query.userId,
    isSimulated: query.simulated === undefined ? undefined : query.simulated === "true",
    from: dateOrUndefined(query.from),
    to: dateOrUndefined(query.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(
    items.map(({ row, pixKeyMasked }) => toWithdrawAdminDto(row, pixKeyMasked)),
    buildPaginationMeta(pagination, total)
  );
}

export async function handleGetWithdrawAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.withdrawals.read");
  const { withdraw, pixKeyMasked } = await paymentService.getWithdrawAdmin(id);
  return ok({ ...withdraw, pixKeyEncrypted: undefined, pixKeyMasked });
}

export async function handleDecideWithdrawAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.withdrawals.approve");
  const body = adminWithdrawDecisionSchema.parse(await req.json());
  const result = await paymentService.decideWithdraw(id, body.action, body.rejectionReason);
  return ok(result);
}

// --------------------------------------------------------------- gateways

export async function handleListGatewaysAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.gateways.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminGatewayListQuerySchema.parse({
    provider: url.searchParams.get("provider") ?? undefined,
    active: url.searchParams.get("active") ?? undefined,
  });

  const { items, total } = await paymentService.listGatewaysAdmin({
    provider: query.provider as GatewayProvider | undefined,
    active: query.active,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toGatewayCredentialAdminDto), buildPaginationMeta(pagination, total));
}

export async function handleGetGatewayAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.gateways.read");
  const credential = await paymentService.getGatewayAdmin(id);
  return ok(toGatewayCredentialAdminDto(credential));
}

export async function handleCreateGatewayAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.gateways.manage");
  const body = gatewayCredentialCreateSchema.parse(await req.json());
  const credential = await paymentService.createGateway({ ...body, createdById: auth.userId });
  return ok(credential, undefined, 201);
}

export async function handleUpdateGatewayAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.gateways.manage");
  const body = gatewayCredentialUpdateSchema.parse(await req.json());
  const credential = await paymentService.updateGateway(id, body);
  return ok(credential);
}

export async function handleTestGatewayConnectionAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.gateways.manage");
  const health = await paymentService.testGatewayConnection(id);
  return ok(health);
}

// --------------------------------------------------------------- webhooks

export async function handleListWebhooksAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.webhooks.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminWebhookListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    provider: url.searchParams.get("provider") ?? undefined,
    relatedType: url.searchParams.get("relatedType") ?? undefined,
    relatedId: url.searchParams.get("relatedId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await paymentService.listWebhooksAdmin({
    status: query.status as WebhookStatus | undefined,
    provider: query.provider as GatewayProvider | undefined,
    relatedType: query.relatedType as PaymentRelatedType | undefined,
    relatedId: query.relatedId,
    from: dateOrUndefined(query.from),
    to: dateOrUndefined(query.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toPaymentWebhookAdminDto), buildPaginationMeta(pagination, total));
}

export async function handleGetWebhookAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.webhooks.read");
  const webhook = await paymentService.getWebhookAdmin(id);
  return ok(toPaymentWebhookAdminDto(webhook));
}

export async function handleReprocessWebhookAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "payments.webhooks.manage");
  const result = await paymentService.reprocessWebhook(id);
  return ok(result);
}

// ------------------------------------------------------------------ logs

export async function handleListGatewayLogsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.logs.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminGatewayLogListQuerySchema.parse({
    gatewayCredentialId: url.searchParams.get("gatewayCredentialId") ?? undefined,
    provider: url.searchParams.get("provider") ?? undefined,
    direction: url.searchParams.get("direction") ?? undefined,
    correlationId: url.searchParams.get("correlationId") ?? undefined,
    success: url.searchParams.get("success") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await paymentService.listGatewayLogsAdmin({
    gatewayCredentialId: query.gatewayCredentialId,
    provider: query.provider as GatewayProvider | undefined,
    direction: query.direction,
    correlationId: query.correlationId,
    success: query.success,
    from: dateOrUndefined(query.from),
    to: dateOrUndefined(query.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toGatewayLogAdminDto), buildPaginationMeta(pagination, total));
}

// -------------------------------------------------------------- settings

export async function handleGetSettingsAdmin(_req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.gateways.read");
  const settings = await paymentService.getSettings();
  return ok(toPaymentSettingsDto(settings));
}

export async function handleUpdateSettingsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "payments.gateways.manage");
  const body = paymentSettingsUpdateSchema.parse(await req.json());
  const settings = await paymentService.updateSettings(body);
  return ok(toPaymentSettingsDto(settings));
}
