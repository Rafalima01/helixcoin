/**
 * Backoffice DTOs — Phase 1 (mockup).
 *
 * These interfaces are the future API contract: every screen consumes ONLY
 * these shapes through the service layer (services.ts). When the real backend
 * lands (Prisma + controllers + repositories), the services swap their mock
 * sources for fetch calls and no screen changes.
 */

export type TrendDirection = "up" | "down" | "flat";

export interface KpiDTO {
  id: string;
  label: string;
  value: string;
  delta?: string;
  trend?: TrendDirection;
  series?: number[];
}

export interface SeriesPointDTO {
  label: string;
  value: number;
}

export type UserStatus = "active" | "blocked" | "pending" | "review";

export interface AdminUserRowDTO {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  createdAt: string;
  lastSeenAt: string;
  kycLevel: "none" | "basic" | "full";
}

export type AdminRole = "owner" | "admin" | "finance" | "support" | "analyst";

export interface AdminAccountDTO {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  twoFactor: boolean;
  lastLoginAt: string;
  status: "active" | "suspended";
}

export interface WalletRowDTO {
  id: string;
  userName: string;
  balance: number;
  bonusBalance: number;
  lockedBalance: number;
  updatedAt: string;
  flagged: boolean;
}

export type LedgerType =
  | "deposit"
  | "withdraw"
  | "bet"
  | "payout"
  | "bonus"
  | "cashback"
  | "commission"
  | "adjustment";

export interface LedgerEntryDTO {
  id: string;
  userName: string;
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  reference: string;
  createdAt: string;
}

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";

export interface PaymentRowDTO {
  id: string;
  userName: string;
  method: string;
  gateway: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface GatewayDTO {
  id: string;
  name: string;
  provider: string;
  status: "online" | "degraded" | "offline";
  successRate: number;
  avgLatencyMs: number;
  volume24h: number;
  fee: string;
}

export interface AffiliateRowDTO {
  id: string;
  name: string;
  code: string;
  network: number;
  depositors: number;
  volume: number;
  commission: number;
  cpa: number;
  revshare: number;
  status: "active" | "paused";
}

export interface FinanceSummaryDTO {
  ggr: number;
  ngr: number;
  deposits: number;
  withdrawals: number;
  bonusCost: number;
  gatewayFees: number;
  affiliateCost: number;
  netProfit: number;
}

export interface GameRowDTO {
  id: string;
  name: string;
  provider: string;
  category: string;
  status: "enabled" | "disabled" | "maintenance";
  sessions24h: number;
  ggr24h: number;
  featured: boolean;
}

export interface PromotionDTO {
  id: string;
  name: string;
  kind: "bonus" | "cashback" | "mission" | "season" | "tournament";
  status: "active" | "scheduled" | "ended" | "draft";
  startsAt: string;
  endsAt: string;
  budget: number;
  used: number;
}

export interface AuditEntryDTO {
  id: string;
  actor: string;
  role: AdminRole;
  action: string;
  target: string;
  ip: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntryDTO {
  id: string;
  level: LogLevel;
  service: string;
  message: string;
  createdAt: string;
}

export interface NotificationCampaignDTO {
  id: string;
  title: string;
  channel: "push" | "email" | "in-app" | "sms";
  audience: string;
  status: "sent" | "scheduled" | "draft";
  sentAt: string;
  openRate: number;
}

export interface IntegrationDTO {
  id: string;
  name: string;
  category: string;
  status: "connected" | "disconnected" | "error";
  lastSyncAt: string;
}

export interface ApiKeyDTO {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
  status: "active" | "revoked";
}

export interface SecurityEventDTO {
  id: string;
  kind: string;
  user: string;
  ip: string;
  location: string;
  riskScore: number;
  status: "open" | "reviewing" | "resolved";
  createdAt: string;
}

export interface QueueDTO {
  id: string;
  name: string;
  pending: number;
  processing: number;
  failed: number;
  throughputPerMin: number;
  oldestJobAge: string;
  status: "healthy" | "backlogged" | "paused";
}

export interface ServiceHealthDTO {
  id: string;
  name: string;
  status: "operational" | "degraded" | "down";
  uptime: number;
  latencyP95Ms: number;
  errorRate: number;
}

export interface InfraNodeDTO {
  id: string;
  name: string;
  region: string;
  kind: string;
  cpu: number;
  memory: number;
  disk: number;
  status: "running" | "provisioning" | "stopped";
}

export interface AlertDTO {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}
