/**
 * Backoffice service layer — the ONLY seam between screens and data.
 *
 * Phase 1: every service resolves mock datasets. When the real backend lands,
 * each function body becomes a `fetch("/api/admin/…")` (or React Query hook)
 * returning the same DTOs — screens don't change. Keep all data access here;
 * never import mock-data directly from a page.
 */
import * as mock from "@/lib/admin/mock-data";
import type {
  AdminAccountDTO,
  AdminUserRowDTO,
  AffiliateRowDTO,
  AlertDTO,
  ApiKeyDTO,
  AuditEntryDTO,
  FinanceSummaryDTO,
  GameRowDTO,
  GatewayDTO,
  IntegrationDTO,
  KpiDTO,
  LedgerEntryDTO,
  LogEntryDTO,
  NotificationCampaignDTO,
  PaymentRowDTO,
  PromotionDTO,
  QueueDTO,
  SecurityEventDTO,
  ServiceHealthDTO,
  InfraNodeDTO,
  WalletRowDTO,
} from "@/lib/admin/types";

const resolve = <T,>(data: T): Promise<T> => Promise.resolve(data);

export const AdminServices = {
  dashboardKpis: (): Promise<KpiDTO[]> => resolve(mock.dashboardKpis),
  alerts: (): Promise<AlertDTO[]> => resolve(mock.dashboardAlerts),
  recentEvents: (): Promise<AuditEntryDTO[]> => resolve(mock.recentEvents),
  users: (): Promise<AdminUserRowDTO[]> => resolve(mock.usersRows),
  adminAccounts: (): Promise<AdminAccountDTO[]> => resolve(mock.adminAccounts),
  wallets: (): Promise<WalletRowDTO[]> => resolve(mock.walletsRows),
  ledger: (): Promise<LedgerEntryDTO[]> => resolve(mock.ledgerRows),
  deposits: (): Promise<PaymentRowDTO[]> => resolve(mock.paymentRows(1, "deposit")),
  withdrawals: (): Promise<PaymentRowDTO[]> => resolve(mock.paymentRows(7, "withdraw")),
  gateways: (): Promise<GatewayDTO[]> => resolve(mock.gateways),
  affiliates: (): Promise<AffiliateRowDTO[]> => resolve(mock.affiliates),
  financeSummary: (): Promise<FinanceSummaryDTO> => resolve(mock.financeSummary),
  games: (): Promise<GameRowDTO[]> => resolve(mock.games),
  promotions: (): Promise<PromotionDTO[]> => resolve(mock.promotions),
  audit: (): Promise<AuditEntryDTO[]> => resolve(mock.auditRows),
  logs: (): Promise<LogEntryDTO[]> => resolve(mock.logRows),
  notifications: (): Promise<NotificationCampaignDTO[]> => resolve(mock.notificationCampaigns),
  integrations: (): Promise<IntegrationDTO[]> => resolve(mock.integrations),
  apiKeys: (): Promise<ApiKeyDTO[]> => resolve(mock.apiKeys),
  securityEvents: (): Promise<SecurityEventDTO[]> => resolve(mock.securityEvents),
  queues: (): Promise<QueueDTO[]> => resolve(mock.queues),
  serviceHealth: (): Promise<ServiceHealthDTO[]> => resolve(mock.services),
  infraNodes: (): Promise<InfraNodeDTO[]> => resolve(mock.infraNodes),
};
