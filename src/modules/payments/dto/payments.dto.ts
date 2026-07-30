import type {
  Deposit,
  DepositAdminRow,
  WithdrawAdminRow,
  GatewayCredentialWithHealth,
  PaymentWebhook,
  GatewayLog,
  PaymentSettings,
} from "@/modules/payments/entities/payments.entity";

// ---------------------------------------------------------------------------
// Player-facing
// ---------------------------------------------------------------------------

/** GET /api/payments/deposits/{id} — the frontend never learns which gateway generated this. */
export interface DepositDto {
  id: string;
  status: string;
  amountCents: number;
  pixCode: string | null;
  qrCodeUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export function toDepositDto(entity: Deposit): DepositDto {
  return {
    id: entity.id,
    status: entity.status,
    amountCents: entity.amountCents,
    pixCode: entity.pixCode,
    qrCodeUrl: entity.qrCodeUrl,
    expiresAt: entity.expiresAt ? entity.expiresAt.toISOString() : null,
    createdAt: entity.createdAt.toISOString(),
    confirmedAt: entity.confirmedAt ? entity.confirmedAt.toISOString() : null,
  };
}

/** POST /api/payments/withdrawals response — status is always PENDING at request time, never an assumed-final balance. */
export interface WithdrawRequestResultDto {
  withdrawId: string;
  status: string;
  amountCents: number;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface DepositAdminDto extends DepositDto {
  userId: string;
  userName: string;
  userEmail: string;
  gatewayCredentialId: string;
  gatewayName: string;
  gatewayProvider: string;
  providerTransactionId: string | null;
  failureReason: string | null;
  updatedAt: string;
}

export function toDepositAdminDto(row: DepositAdminRow): DepositAdminDto {
  return {
    ...toDepositDto(row),
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    gatewayCredentialId: row.gatewayCredentialId,
    gatewayName: row.gatewayName,
    gatewayProvider: row.gatewayProvider,
    providerTransactionId: row.providerTransactionId,
    failureReason: row.failureReason,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `pixKeyMasked` is always precomputed by the caller (services/payment.service.ts) — the DTO layer never decrypts a PIX key itself. */
export interface WithdrawAdminDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountCents: number;
  status: string;
  pixKeyMasked: string;
  pixKeyType: string | null;
  gatewayCredentialId: string;
  gatewayName: string;
  gatewayProvider: string;
  providerTransactionId: string | null;
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  failureReason: string | null;
  createdAt: string;
}

export function toWithdrawAdminDto(row: WithdrawAdminRow, pixKeyMasked: string): WithdrawAdminDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    amountCents: row.amountCents,
    status: row.status,
    pixKeyMasked,
    pixKeyType: row.pixKeyType,
    gatewayCredentialId: row.gatewayCredentialId,
    gatewayName: row.gatewayName,
    gatewayProvider: row.gatewayProvider,
    providerTransactionId: row.providerTransactionId,
    requestedAt: row.requestedAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    rejectionReason: row.rejectionReason,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Never includes `credentialsEncrypted`/`webhookSecretEncrypted` — those never leave the server. */
export interface GatewayCredentialAdminDto {
  id: string;
  name: string;
  provider: string;
  mode: string;
  active: boolean;
  priority: number;
  weight: number;
  timeoutMs: number;
  maxRetries: number;
  simulatedHealth: string | null;
  simulatedErrorMode: string | null;
  latestHealthStatus: string | null;
  latestHealthCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toGatewayCredentialAdminDto(entity: GatewayCredentialWithHealth): GatewayCredentialAdminDto {
  return {
    id: entity.id,
    name: entity.name,
    provider: entity.provider,
    mode: entity.mode,
    active: entity.active,
    priority: entity.priority,
    weight: entity.weight,
    timeoutMs: entity.timeoutMs,
    maxRetries: entity.maxRetries,
    simulatedHealth: entity.simulatedHealth,
    simulatedErrorMode: entity.simulatedErrorMode,
    latestHealthStatus: entity.latestHealth?.status ?? null,
    latestHealthCheckedAt: entity.latestHealth?.checkedAt.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export interface PaymentWebhookAdminDto {
  id: string;
  gatewayCredentialId: string;
  provider: string;
  relatedType: string;
  relatedId: string;
  eventType: string;
  status: string;
  providerEventId: string | null;
  payloadHash: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  signatureValid: boolean;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
  reprocessedAt: string | null;
  reprocessCount: number;
  processingMs: number | null;
}

export function toPaymentWebhookAdminDto(entity: PaymentWebhook): PaymentWebhookAdminDto {
  return {
    id: entity.id,
    gatewayCredentialId: entity.gatewayCredentialId,
    provider: entity.provider,
    relatedType: entity.relatedType,
    relatedId: entity.relatedId,
    eventType: entity.eventType,
    status: entity.status,
    providerEventId: entity.providerEventId,
    payloadHash: entity.payloadHash,
    payload: entity.payload,
    responseStatus: entity.responseStatus,
    responseBody: entity.responseBody,
    signatureValid: entity.signatureValid,
    errorMessage: entity.errorMessage,
    receivedAt: entity.receivedAt.toISOString(),
    processedAt: entity.processedAt ? entity.processedAt.toISOString() : null,
    reprocessedAt: entity.reprocessedAt ? entity.reprocessedAt.toISOString() : null,
    reprocessCount: entity.reprocessCount,
    processingMs: entity.processingMs,
  };
}

/** `requestSummary`/`responseSummary` are already pre-sanitized on the entity itself — never a secret substring, see GatewayLog's schema doc comment. */
export interface GatewayLogAdminDto {
  id: string;
  gatewayCredentialId: string | null;
  provider: string | null;
  direction: string;
  endpoint: string;
  method: string | null;
  requestSummary: Record<string, unknown> | null;
  responseSummary: Record<string, unknown> | null;
  statusCode: number | null;
  durationMs: number | null;
  success: boolean;
  errorMessage: string | null;
  correlationId: string | null;
  createdAt: string;
}

export function toGatewayLogAdminDto(entity: GatewayLog): GatewayLogAdminDto {
  return {
    id: entity.id,
    gatewayCredentialId: entity.gatewayCredentialId,
    provider: entity.provider,
    direction: entity.direction,
    endpoint: entity.endpoint,
    method: entity.method,
    requestSummary: entity.requestSummary,
    responseSummary: entity.responseSummary,
    statusCode: entity.statusCode,
    durationMs: entity.durationMs,
    success: entity.success,
    errorMessage: entity.errorMessage,
    correlationId: entity.correlationId,
    createdAt: entity.createdAt.toISOString(),
  };
}

export interface PaymentSettingsDto {
  id: string;
  defaultGatewayCredentialId: string | null;
  routingMode: string;
  timeoutMs: number;
  maxRetries: number;
  pixExpirationMinutes: number;
  depositMinCents: number;
  depositMaxCents: number;
  withdrawMinCents: number;
  withdrawMaxCents: number;
  maxWebhookProcessingMs: number;
  updatedAt: string;
}

export function toPaymentSettingsDto(entity: PaymentSettings): PaymentSettingsDto {
  return {
    id: entity.id,
    defaultGatewayCredentialId: entity.defaultGatewayCredentialId,
    routingMode: entity.routingMode,
    timeoutMs: entity.timeoutMs,
    maxRetries: entity.maxRetries,
    pixExpirationMinutes: entity.pixExpirationMinutes,
    depositMinCents: entity.depositMinCents,
    depositMaxCents: entity.depositMaxCents,
    withdrawMinCents: entity.withdrawMinCents,
    withdrawMaxCents: entity.withdrawMaxCents,
    maxWebhookProcessingMs: entity.maxWebhookProcessingMs,
    updatedAt: entity.updatedAt.toISOString(),
  };
}
