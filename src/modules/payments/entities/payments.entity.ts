import type {
  GatewayProvider,
  GatewayMode,
  RoutingMode,
  DepositStatus,
  WithdrawStatus,
  WebhookStatus,
  GatewayHealthStatus,
  GatewaySimulatedFault,
  PaymentRelatedType,
} from "@prisma/client";

export type {
  GatewayProvider,
  GatewayMode,
  RoutingMode,
  DepositStatus,
  WithdrawStatus,
  WebhookStatus,
  GatewayHealthStatus,
  GatewaySimulatedFault,
  PaymentRelatedType,
};

/** Domain entity — one registered gateway configuration. `credentialsEncrypted`/`webhookSecretEncrypted` are AES-256-GCM ("iv:authTag:ciphertext") — only ProviderFactory ever decrypts them. */
export interface GatewayCredential {
  id: string;
  name: string;
  provider: GatewayProvider;
  mode: GatewayMode;
  active: boolean;
  priority: number;
  weight: number;
  timeoutMs: number;
  maxRetries: number;
  credentialsEncrypted: string;
  webhookSecretEncrypted: string;
  /** Mock-only test lever — see schema doc comment. Null means "report real health". */
  simulatedHealth: GatewayHealthStatus | null;
  /** Mock-only test lever (Fase 10) — see schema doc comment. Null means "no simulated fault". */
  simulatedErrorMode: GatewaySimulatedFault | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain entity — one PIX deposit charge. `id` is pre-generated client-side by PaymentService, before the provider call. */
export interface Deposit {
  id: string;
  userId: string;
  gatewayCredentialId: string;
  amountCents: number;
  status: DepositStatus;
  providerTransactionId: string | null;
  pixCode: string | null;
  qrCodeUrl: string | null;
  expiresAt: Date | null;
  walletTransactionId: string | null;
  confirmedAt: Date | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain entity — one withdrawal request. `pixKeyEncrypted` is AES-256-GCM, same as GatewayCredential's secrets. */
export interface Withdraw {
  id: string;
  userId: string;
  gatewayCredentialId: string;
  amountCents: number;
  status: WithdrawStatus;
  pixKeyEncrypted: string;
  pixKeyType: string | null;
  providerTransactionId: string | null;
  lockWalletTransactionId: string | null;
  settleWalletTransactionId: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  rejectionReason: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain entity — one inbound gateway webhook delivery. */
export interface PaymentWebhook {
  id: string;
  gatewayCredentialId: string;
  provider: GatewayProvider;
  relatedType: PaymentRelatedType;
  relatedId: string;
  eventType: string;
  status: WebhookStatus;
  providerEventId: string | null;
  payloadHash: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  signatureValid: boolean;
  errorMessage: string | null;
  receivedAt: Date;
  processedAt: Date | null;
  reprocessedAt: Date | null;
  reprocessCount: number;
  processingMs: number | null;
}

/** Domain entity — one append-only health-check row. Never mutated once written. */
export interface GatewayHealth {
  id: string;
  gatewayCredentialId: string;
  status: GatewayHealthStatus;
  latencyMs: number | null;
  message: string | null;
  checkedAt: Date;
}

/** Domain entity — one outbound provider call / inbound webhook log row. `requestSummary`/`responseSummary` are always pre-sanitized before reaching this shape. */
export interface GatewayLog {
  id: string;
  gatewayCredentialId: string | null;
  provider: GatewayProvider | null;
  direction: "outbound" | "inbound";
  endpoint: string;
  method: string | null;
  requestSummary: Record<string, unknown> | null;
  responseSummary: Record<string, unknown> | null;
  statusCode: number | null;
  durationMs: number | null;
  success: boolean;
  errorMessage: string | null;
  correlationId: string | null;
  createdAt: Date;
}

/** Domain entity — single global row (id "global"). PaymentService and the admin Gateways screen are its only consumers. */
export interface PaymentSettings {
  id: string;
  defaultGatewayCredentialId: string | null;
  routingMode: RoutingMode;
  timeoutMs: number;
  maxRetries: number;
  pixExpirationMinutes: number;
  depositMinCents: number;
  depositMaxCents: number;
  withdrawMinCents: number;
  withdrawMaxCents: number;
  maxWebhookProcessingMs: number;
  updatedAt: Date;
}

/** Admin list row — GatewayCredential joined with its latest GatewayHealth row. */
export interface GatewayCredentialWithHealth extends GatewayCredential {
  latestHealth: GatewayHealth | null;
}

/** Admin list row — Deposit joined with the owning user's display fields and the gateway's name/provider. */
export interface DepositAdminRow extends Deposit {
  userName: string;
  userEmail: string;
  gatewayName: string;
  gatewayProvider: GatewayProvider;
}

/** Admin list row — Withdraw joined the same way as DepositAdminRow. `pixKeyEncrypted` is still the raw encrypted value here — only PaymentService decrypts+masks it before it reaches a DTO. */
export interface WithdrawAdminRow extends Withdraw {
  userName: string;
  userEmail: string;
  gatewayName: string;
  gatewayProvider: GatewayProvider;
}
