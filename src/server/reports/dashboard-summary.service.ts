import { prisma } from "@/lib/prisma";

export interface DashboardKpiRaw {
  id: string;
  depositsCents: number;
  depositsPrevCents: number;
  withdrawalsCents: number;
  withdrawalsPrevCents: number;
  newPlayers: number;
  newPlayersPrev: number;
  ggrCents: number;
  ggrPrevCents: number;
}

export interface DashboardSummary {
  kpis: DashboardKpiRaw;
  ngrCents: number;
  ngrPrevCents: number;
  depositsByDay: { label: string; valueCents: number }[];
  gatewayVolume: { label: string; valueCents: number }[];
  connectedGateways: number;
  activeGateways: number;
  alerts: DashboardAlert[];
}

export interface DashboardAlert {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

const STUCK_DEPOSIT_MINUTES = 30;
const STUCK_WITHDRAW_HOURS = 24;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeDaysAgo(days: number, from: Date): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Read-only cross-cutting aggregation for the admin Dashboard landing page —
 * same "report generation, not business logic" allowance already used by
 * DailySummaryService (src/modules/notifications/services). Nothing here
 * writes data; every number is derived straight from Deposit/Withdraw/
 * WalletTransaction/GatewayCredential/GatewayHealth, so it can never drift
 * from what the dedicated Pagamentos/Usuários screens already show.
 */
export class DashboardSummaryService {
  async build(days = 7): Promise<DashboardSummary> {
    const now = new Date();
    const periodStart = rangeDaysAgo(days, now);
    const prevPeriodStart = rangeDaysAgo(days * 2, now);

    const [
      depositsAgg,
      depositsPrevAgg,
      withdrawalsAgg,
      withdrawalsPrevAgg,
      newPlayers,
      newPlayersPrev,
      betAgg,
      payoutAgg,
      bonusAgg,
      betPrevAgg,
      payoutPrevAgg,
      bonusPrevAgg,
      depositRows,
      gatewayVolumeRows,
      connectedGateways,
      activeGateways,
      gatewayCredentials,
      stuckDeposits,
      stuckWithdrawals,
    ] = await Promise.all([
      prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: periodStart } }, _sum: { amountCents: true } }),
      prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: prevPeriodStart, lt: periodStart } }, _sum: { amountCents: true } }),
      prisma.withdraw.aggregate({ where: { status: "APPROVED", processedAt: { gte: periodStart } }, _sum: { amountCents: true } }),
      prisma.withdraw.aggregate({ where: { status: "APPROVED", processedAt: { gte: prevPeriodStart, lt: periodStart } }, _sum: { amountCents: true } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: periodStart } } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: prevPeriodStart, lt: periodStart } } }),
      prisma.walletTransaction.aggregate({ where: { type: "BET", status: "COMPLETED", createdAt: { gte: periodStart } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "PAYOUT", status: "COMPLETED", createdAt: { gte: periodStart } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "BONUS", status: "COMPLETED", createdAt: { gte: periodStart } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "BET", status: "COMPLETED", createdAt: { gte: prevPeriodStart, lt: periodStart } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "PAYOUT", status: "COMPLETED", createdAt: { gte: prevPeriodStart, lt: periodStart } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "BONUS", status: "COMPLETED", createdAt: { gte: prevPeriodStart, lt: periodStart } }, _sum: { amount: true } }),
      prisma.deposit.findMany({
        where: { status: "PAID", confirmedAt: { gte: periodStart } },
        select: { amountCents: true, confirmedAt: true },
      }),
      prisma.deposit.groupBy({
        by: ["gatewayCredentialId"],
        where: { status: "PAID", confirmedAt: { gte: periodStart } },
        _sum: { amountCents: true },
      }),
      prisma.gatewayCredential.count(),
      prisma.gatewayCredential.count({ where: { active: true } }),
      prisma.gatewayCredential.findMany({ select: { id: true, name: true, active: true } }),
      prisma.deposit.findMany({
        where: { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: new Date(now.getTime() - STUCK_DEPOSIT_MINUTES * 60 * 1000) } },
        select: { id: true, amountCents: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "asc" },
      }),
      prisma.withdraw.findMany({
        where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - STUCK_WITHDRAW_HOURS * 60 * 60 * 1000) } },
        select: { id: true, amountCents: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const depositsByDayMap = new Map<string, number>();
    for (const row of depositRows) {
      if (!row.confirmedAt) continue;
      const key = dayKey(row.confirmedAt);
      depositsByDayMap.set(key, (depositsByDayMap.get(key) ?? 0) + row.amountCents);
    }
    const depositsByDay: { label: string; valueCents: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = rangeDaysAgo(i, now);
      const key = dayKey(d);
      depositsByDay.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valueCents: depositsByDayMap.get(key) ?? 0,
      });
    }

    const credentialById = new Map(gatewayCredentials.map((g) => [g.id, g.name]));
    const gatewayVolume = gatewayVolumeRows
      .map((row) => ({
        label: credentialById.get(row.gatewayCredentialId) ?? "Desconhecido",
        valueCents: row._sum.amountCents ?? 0,
      }))
      .sort((a, b) => b.valueCents - a.valueCents);

    const ggrCents = (betAgg._sum.amount ?? 0) - (payoutAgg._sum.amount ?? 0);
    const ggrPrevCents = (betPrevAgg._sum.amount ?? 0) - (payoutPrevAgg._sum.amount ?? 0);
    const ngrCents = ggrCents - (bonusAgg._sum.amount ?? 0);
    const ngrPrevCents = ggrPrevCents - (bonusPrevAgg._sum.amount ?? 0);

    const alerts: DashboardAlert[] = [];

    const inactiveCredentials = gatewayCredentials.filter((g) => !g.active);
    if (activeGateways === 0 && connectedGateways > 0) {
      alerts.push({
        id: "alert-no-active-gateway",
        title: "Nenhum gateway ativo",
        detail: "Todos os gateways de pagamento configurados estão inativos — depósitos e saques não podem ser processados.",
        severity: "critical",
        createdAt: now.toISOString(),
      });
    } else if (inactiveCredentials.length > 0) {
      alerts.push({
        id: "alert-inactive-gateways",
        title: `${inactiveCredentials.length} gateway(s) inativo(s)`,
        detail: inactiveCredentials.map((g) => g.name).join(", "),
        severity: "info",
        createdAt: now.toISOString(),
      });
    }

    if (stuckDeposits.length > 0) {
      alerts.push({
        id: "alert-stuck-deposits",
        title: `${stuckDeposits.length} depósito(s) pendente(s) há mais de ${STUCK_DEPOSIT_MINUTES}min`,
        detail: "Pode indicar falha de webhook ou instabilidade no gateway — verifique em Pagamentos › Depósitos.",
        severity: "warning",
        createdAt: now.toISOString(),
      });
    }

    if (stuckWithdrawals.length > 0) {
      alerts.push({
        id: "alert-stuck-withdrawals",
        title: `${stuckWithdrawals.length} saque(s) pendente(s) há mais de ${STUCK_WITHDRAW_HOURS}h`,
        detail: "Aguardando aprovação manual — verifique em Pagamentos › Saques.",
        severity: "warning",
        createdAt: now.toISOString(),
      });
    }

    return {
      kpis: {
        id: "dashboard-kpis",
        depositsCents: depositsAgg._sum.amountCents ?? 0,
        depositsPrevCents: depositsPrevAgg._sum.amountCents ?? 0,
        withdrawalsCents: withdrawalsAgg._sum.amountCents ?? 0,
        withdrawalsPrevCents: withdrawalsPrevAgg._sum.amountCents ?? 0,
        newPlayers,
        newPlayersPrev,
        ggrCents,
        ggrPrevCents,
      },
      ngrCents,
      ngrPrevCents,
      depositsByDay,
      gatewayVolume,
      connectedGateways,
      activeGateways,
      alerts,
    };
  }
}
