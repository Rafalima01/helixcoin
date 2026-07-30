import type {
  GatewayCredential,
  GatewayCredentialWithHealth,
  GatewayProvider,
  GatewayMode,
  GatewayHealthStatus,
  GatewaySimulatedFault,
} from "@/modules/payments/entities/payments.entity";

export interface CreateGatewayCredentialInput {
  id?: string;
  name: string;
  provider: GatewayProvider;
  mode?: GatewayMode;
  active?: boolean;
  priority?: number;
  weight?: number;
  timeoutMs?: number;
  maxRetries?: number;
  credentialsEncrypted: string;
  webhookSecretEncrypted: string;
  simulatedHealth?: GatewayHealthStatus | null;
  simulatedErrorMode?: GatewaySimulatedFault | null;
  createdById?: string | null;
}

export interface UpdateGatewayCredentialInput {
  name?: string;
  mode?: GatewayMode;
  active?: boolean;
  priority?: number;
  weight?: number;
  timeoutMs?: number;
  maxRetries?: number;
  credentialsEncrypted?: string;
  webhookSecretEncrypted?: string;
  simulatedHealth?: GatewayHealthStatus | null;
  simulatedErrorMode?: GatewaySimulatedFault | null;
}

export interface GatewayCredentialListFilter {
  provider?: GatewayProvider;
  active?: boolean;
  page: number;
  pageSize: number;
}

/** Service layer depends on this interface only, never on `@/lib/prisma` directly — see repositories/ for the Prisma + in-memory implementations. */
export interface IGatewayCredentialRepository {
  findById(id: string): Promise<GatewayCredential | null>;
  /** All rows for a given provider, active or not — used by webhook handling, which must try every registered credential for that provider until one validates the signature. */
  listByProvider(provider: GatewayProvider): Promise<GatewayCredential[]>;
  /** Active rows only, for routing candidate resolution. */
  listActive(): Promise<GatewayCredential[]>;
  listAdmin(filter: GatewayCredentialListFilter): Promise<{ items: GatewayCredentialWithHealth[]; total: number }>;
  create(input: CreateGatewayCredentialInput): Promise<GatewayCredential>;
  update(id: string, input: UpdateGatewayCredentialInput): Promise<GatewayCredential>;
}
