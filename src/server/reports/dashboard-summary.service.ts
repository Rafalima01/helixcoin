import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE, previousPeriod, type DateRange } from "@/lib/date-range";

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

export interface DashboardUsers {
  totalUsers: number;
  activeUsers: number;
  newSignups: number;
  newSignupsPrev: number;
  activePlayersInPeriod: number;
  /** Session-based proxy (lastActivityAt within 15min) — NOT true real-time presence. No Redis/heartbeat presence tracking exists in this project. */
  approxOnlineSessions: number;
}

export interface DashboardAcquisition {
  ftds: number;
  ftdsPrev: number;
  /** ftds / newSignups — cohorts are not aligned (an FTD in-period may belong to a signup from an earlier period). */
  conversionRate: number | null;
  depositors: number;
  /** depositors / newSignups — same cohort caveat as conversionRate. */
  depositorsPerSignup: number | null;
  confirmedDeposits: number;
  avgDepositTicketCents: number | null;
}

export interface DashboardFinancial {
  depositsCents: number;
  withdrawalsCents: number;
  ggrCents: number;
  ngrCents: number;
  bonusCostCents: number;
  revshareCostCents: number;
  /** revshare + any legacy CPA rows still on record — see legacyCpaAgg below. */
  affiliateCostCents: number;
  managerSpreadCostCents: number;
  netProfitCents: number;
  /** netProfitCents / ggrCents — null when ggrCents is 0 (can't divide). */
  marginPct: number | null;
}

export interface DashboardGame {
  matchesStarted: number;
  matchesCompleted: number;
  matchesWon: number;
  matchesLost: number;
  cashouts: number;
  completionRate: number | null;
  cashoutRate: number | null;
  avgMultiplier: number | null;
  maxMultiplier: number | null;
  avgPlatformsPerMatch: number | null;
  /** SUM(payout)/SUM(betAmount) over resolved matches — derived, not a stored field. Distinct from the *configured* RTP target in /admin/rtp. */
  avgRealizedRtpPct: number | null;
}

export interface DashboardCommercial {
  activeAffiliates: number;
  activeManagers: number;
  /** Level-1 direct referral only — see this file's doc comment for why. */
  affiliateReferredPlayers: number;
  affiliateFtds: number;
  affiliateDrivenDepositsCents: number;
  commissionGeneratedCents: number;
  revshareCostCents: number;
  /** commissionGeneratedCents / ggrCents — null when ggrCents is 0. */
  pctGgrDistributed: number | null;
}

export interface DashboardSummary {
  range: { start: string; end: string };
  kpis: DashboardKpiRaw;
  ngrCents: number;
  ngrPrevCents: number;
  users: DashboardUsers;
  acquisition: DashboardAcquisition;
  financial: DashboardFinancial;
  game: DashboardGame;
  commercial: DashboardCommercial;
  depositsByDay: { label: string; valueCents: number }[];
  signupsByDay: { label: string; value: number }[];
  ggrByDay: { label: string; ggrCents: number; ngrCents: number }[];
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
const ONLINE_PROXY_WINDOW_MINUTES = 15;
const PAID_COMMISSION_STATUSES = ["LOCKED", "AVAILABLE"] as const;

function labelDay(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: APP_TIMEZONE });
}

function dayKey(d: Date): string {
  // YYYY-MM-DD in APP_TIMEZONE, to match the raw SQL's date_trunc(... AT TIME ZONE ...) bucket key.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Every calendar day (APP_TIMEZONE) in [start, end), inclusive of the start day. */
function dayLabelsInRange(start: Date, end: Date): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const cursor = new Date(start);
  // Walk in real 24h UTC steps then re-derive the local key/label each time —
  // safe because we only use this to enumerate days, never to compute exact boundaries.
  while (cursor < end) {
    out.push({ key: dayKey(cursor), label: labelDay(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Read-only cross-cutting aggregation for the admin Dashboard landing page —
 * same "report generation, not business logic" allowance already used by
 * DailySummaryService (src/modules/notifications/services). Nothing here
 * writes data; every number is derived straight from real models, so it can
 * never drift from what the dedicated Pagamentos/Usuários/Partidas screens
 * already show. Every day-bucketed series uses raw SQL with `AT TIME ZONE
 * 'America/Sao_Paulo'` (see src/lib/date-range.ts's APP_TIMEZONE) so a
 * "day" here means a São Paulo calendar day, not a UTC one.
 *
 * Affiliate/commercial numbers only count LEVEL-1 direct referrals
 * (User.referredById) — a multi-level rollup (2nd/3rd tier) would need a
 * new tree-walk aggregate that doesn't exist anywhere in the codebase today
 * (see commission.service.ts's per-commission tree-walk, which isn't a
 * bulk-queryable rollup) and is out of scope here.
 */
export class DashboardSummaryService {
  async build(range: DateRange): Promise<DashboardSummary> {
    const { start, end } = range;
    const prev = previousPeriod(range);
    const now = new Date();

    const affiliateUsers = await prisma.affiliateProfile.findMany({
      where: { status: "APPROVED" },
      select: { userId: true },
    });
    const affiliateUserIds = affiliateUsers.map((a) => a.userId);
    const hasAffiliates = affiliateUserIds.length > 0;

    const [
      depositsAgg,
      depositsPrevAgg,
      withdrawalsAgg,
      withdrawalsPrevAgg,
      newSignups,
      newSignupsPrev,
      betAgg,
      payoutAgg,
      bonusAgg,
      betPrevAgg,
      payoutPrevAgg,
      bonusPrevAgg,
      legacyCpaAgg,
      revshareAgg,
      managerSpreadAgg,
      totalUsers,
      activeUsers,
      activePlayerGroups,
      onlineSessionGroups,
      depositorGroups,
      ftdCountRows,
      avgTicketAgg,
      matchesStarted,
      matchesCompleted,
      matchesWon,
      matchesLost,
      multiplierAgg,
      platformsAgg,
      rtpAgg,
      activeAffiliates,
      activeManagers,
      affiliateReferredPlayers,
      affiliateFtdRows,
      affiliateDepositsAgg,
      commissionAgg,
      depositsByDayRows,
      signupsByDayRows,
      ggrNgrByDayRows,
      gatewayVolumeRows,
      connectedGateways,
      activeGateways,
      gatewayCredentials,
      stuckDeposits,
      stuckWithdrawals,
    ] = await Promise.all([
      prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: prev.start, lt: prev.end } }, _sum: { amountCents: true } }),
      prisma.withdraw.aggregate({ where: { status: "APPROVED", processedAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.withdraw.aggregate({ where: { status: "APPROVED", processedAt: { gte: prev.start, lt: prev.end } }, _sum: { amountCents: true } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: start, lt: end } } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: prev.start, lt: prev.end } } }),
      prisma.walletTransaction.aggregate({ where: { type: "BET", status: "COMPLETED", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "PAYOUT", status: "COMPLETED", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "BONUS", status: "COMPLETED", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "BET", status: "COMPLETED", createdAt: { gte: prev.start, lt: prev.end } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "PAYOUT", status: "COMPLETED", createdAt: { gte: prev.start, lt: prev.end } }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { type: "BONUS", status: "COMPLETED", createdAt: { gte: prev.start, lt: prev.end } }, _sum: { amount: true } }),
      prisma.commission.aggregate({ where: { sourceType: "CPA_FTD", status: { in: [...PAID_COMMISSION_STATUSES] }, createdAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.commission.aggregate({ where: { sourceType: "REVSHARE_DEPOSIT", status: { in: [...PAID_COMMISSION_STATUSES] }, createdAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.commission.aggregate({ where: { sourceType: "MANAGER_SPREAD", status: { in: [...PAID_COMMISSION_STATUSES] }, createdAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.user.count({ where: { role: "USER", deletedAt: null } }),
      prisma.user.count({ where: { role: "USER", status: "ACTIVE", deletedAt: null } }),
      prisma.match.groupBy({ by: ["userId"], where: { createdAt: { gte: start, lt: end } } }),
      prisma.session.groupBy({
        by: ["userId"],
        where: {
          status: "ACTIVE",
          expiresAt: { gt: now },
          lastActivityAt: { gte: new Date(now.getTime() - ONLINE_PROXY_WINDOW_MINUTES * 60 * 1000) },
        },
      }),
      prisma.deposit.groupBy({ by: ["userId"], where: { status: "PAID", confirmedAt: { gte: start, lt: end } } }),
      // First-ever PAID deposit per user, filtered to those that fall in this period — computed
      // in SQL (DISTINCT ON, ordered by confirmedAt) instead of loading every depositor into Node.
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT DISTINCT ON ("userId") "userId", "confirmedAt"
          FROM "Deposit"
          WHERE status = 'PAID'
          ORDER BY "userId", "confirmedAt" ASC
        ) first_deposits
        WHERE "confirmedAt" >= ${start} AND "confirmedAt" < ${end}
      `,
      prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: start, lt: end } }, _avg: { amountCents: true } }),
      prisma.match.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.match.count({ where: { status: { in: ["CASHED_OUT", "LOST"] }, resolvedAt: { gte: start, lt: end } } }),
      prisma.match.count({ where: { status: "CASHED_OUT", resolvedAt: { gte: start, lt: end } } }),
      prisma.match.count({ where: { status: "LOST", resolvedAt: { gte: start, lt: end } } }),
      prisma.match.aggregate({ where: { status: "CASHED_OUT", resolvedAt: { gte: start, lt: end } }, _avg: { multiplier: true }, _max: { multiplier: true } }),
      prisma.match.aggregate({ where: { resolvedAt: { gte: start, lt: end } }, _avg: { platformsPassed: true } }),
      prisma.match.aggregate({ where: { status: { in: ["CASHED_OUT", "LOST"] }, resolvedAt: { gte: start, lt: end } }, _sum: { payout: true, betAmount: true } }),
      prisma.affiliateProfile.count({ where: { status: "APPROVED" } }),
      prisma.managerProfile.count({ where: { status: "ACTIVE" } }),
      hasAffiliates ? prisma.user.count({ where: { createdAt: { gte: start, lt: end }, referredById: { in: affiliateUserIds } } }) : Promise.resolve(0),
      // Real first-ever PAID deposits by affiliate-referred players, in period.
      // Previously this counted CPA_FTD commission rows — which only ever
      // existed while a CPA bonus was configured, and now that CPA is gone
      // would report 0 FTDs forever. Derived from Deposit directly, so it is
      // independent of any commission model.
      hasAffiliates
        ? prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count FROM (
              SELECT DISTINCT ON (d."userId") d."userId", d."confirmedAt"
              FROM "Deposit" d
              JOIN "User" u ON u.id = d."userId"
              WHERE d.status = 'PAID' AND u."referredById" = ANY(${affiliateUserIds})
              ORDER BY d."userId", d."confirmedAt" ASC
            ) first_deposits
            WHERE "confirmedAt" >= ${start} AND "confirmedAt" < ${end}
          `
        : Promise.resolve([{ count: BigInt(0) }]),
      hasAffiliates
        ? prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: start, lt: end }, user: { referredById: { in: affiliateUserIds } } }, _sum: { amountCents: true } })
        : Promise.resolve({ _sum: { amountCents: 0 } }),
      prisma.commission.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.$queryRaw<{ day: Date; total: bigint | null }[]>`
        SELECT (date_trunc('day', "confirmedAt" AT TIME ZONE ${APP_TIMEZONE}))::date AS day,
               SUM("amountCents")::bigint AS total
        FROM "Deposit"
        WHERE status = 'PAID' AND "confirmedAt" >= ${start} AND "confirmedAt" < ${end}
        GROUP BY day ORDER BY day
      `,
      prisma.$queryRaw<{ day: Date; total: bigint | null }[]>`
        SELECT (date_trunc('day', "createdAt" AT TIME ZONE ${APP_TIMEZONE}))::date AS day,
               COUNT(*)::bigint AS total
        FROM "User"
        WHERE role = 'USER' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY day ORDER BY day
      `,
      prisma.$queryRaw<{ day: Date; type: string; total: bigint | null }[]>`
        SELECT (date_trunc('day', "createdAt" AT TIME ZONE ${APP_TIMEZONE}))::date AS day,
               type,
               SUM(amount)::bigint AS total
        FROM "WalletTransaction"
        WHERE type IN ('BET','PAYOUT','BONUS') AND status = 'COMPLETED' AND "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY day, type ORDER BY day
      `,
      prisma.deposit.groupBy({
        by: ["gatewayCredentialId"],
        where: { status: "PAID", confirmedAt: { gte: start, lt: end } },
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

    // ---- Financial ----
    const ggrCents = (betAgg._sum.amount ?? 0) - (payoutAgg._sum.amount ?? 0);
    const ggrPrevCents = (betPrevAgg._sum.amount ?? 0) - (payoutPrevAgg._sum.amount ?? 0);
    const bonusCostCents = bonusAgg._sum.amount ?? 0;
    const ngrCents = ggrCents - bonusCostCents;
    const ngrPrevCents = ggrPrevCents - (bonusPrevAgg._sum.amount ?? 0);
    const revshareCostCents = revshareAgg._sum.amountCents ?? 0;
    // Legacy CPA rows are still real money already paid out, so they must stay
    // in the cost side or historical net profit would be overstated. No new
    // CPA row can be created (percentage-only platform) — for any period after
    // the CPA removal this term is simply 0.
    const affiliateCostCents = (legacyCpaAgg._sum.amountCents ?? 0) + revshareCostCents;
    const managerSpreadCostCents = managerSpreadAgg._sum.amountCents ?? 0;
    const netProfitCents = ngrCents - affiliateCostCents - managerSpreadCostCents;

    const financial: DashboardFinancial = {
      depositsCents: depositsAgg._sum.amountCents ?? 0,
      withdrawalsCents: withdrawalsAgg._sum.amountCents ?? 0,
      ggrCents,
      ngrCents,
      bonusCostCents,
      revshareCostCents,
      affiliateCostCents,
      managerSpreadCostCents,
      netProfitCents,
      marginPct: ratio(netProfitCents, ggrCents),
    };

    // ---- Users ----
    const users: DashboardUsers = {
      totalUsers,
      activeUsers,
      newSignups,
      newSignupsPrev,
      activePlayersInPeriod: activePlayerGroups.length,
      approxOnlineSessions: onlineSessionGroups.length,
    };

    // ---- Acquisition ----
    const ftds = Number(ftdCountRows[0]?.count ?? BigInt(0));
    const depositors = depositorGroups.length;
    const acquisition: DashboardAcquisition = {
      ftds,
      ftdsPrev: 0, // trend not computed for FTDs — would need the same DISTINCT ON query against prev range; kept simple for now
      conversionRate: ratio(ftds, newSignups),
      depositors,
      depositorsPerSignup: ratio(depositors, newSignups),
      confirmedDeposits: depositors, // one row per distinct depositor; count of confirmed deposit EVENTS would need a separate count() — depositors already answers "how many people paid"
      avgDepositTicketCents: avgTicketAgg._avg.amountCents ?? null,
    };

    // ---- Game ----
    const rtpPayout = rtpAgg._sum.payout ?? 0;
    const rtpBet = rtpAgg._sum.betAmount ?? 0;
    const game: DashboardGame = {
      matchesStarted,
      matchesCompleted,
      matchesWon,
      matchesLost,
      cashouts: matchesWon,
      completionRate: ratio(matchesCompleted, matchesStarted),
      cashoutRate: ratio(matchesWon, matchesCompleted),
      avgMultiplier: multiplierAgg._avg.multiplier ?? null,
      maxMultiplier: multiplierAgg._max.multiplier ?? null,
      avgPlatformsPerMatch: platformsAgg._avg.platformsPassed ?? null,
      avgRealizedRtpPct: rtpBet > 0 ? rtpPayout / rtpBet : null,
    };

    // ---- Commercial ----
    const commissionGeneratedCents = commissionAgg._sum.amountCents ?? 0;
    const commercial: DashboardCommercial = {
      activeAffiliates,
      activeManagers,
      affiliateReferredPlayers,
      affiliateFtds: Number(affiliateFtdRows[0]?.count ?? BigInt(0)),
      affiliateDrivenDepositsCents: affiliateDepositsAgg._sum.amountCents ?? 0,
      commissionGeneratedCents,
      revshareCostCents,
      pctGgrDistributed: ratio(commissionGeneratedCents, ggrCents),
    };

    // ---- Day-bucketed series (fill every day in range, even ones with 0) ----
    const days = dayLabelsInRange(start, end);

    const depositsByDayMap = new Map(depositsByDayRows.map((r) => [dayKey(r.day), Number(r.total ?? BigInt(0))]));
    const depositsByDay = days.map((d) => ({ label: d.label, valueCents: depositsByDayMap.get(d.key) ?? 0 }));

    const signupsByDayMap = new Map(signupsByDayRows.map((r) => [dayKey(r.day), Number(r.total ?? BigInt(0))]));
    const signupsByDay = days.map((d) => ({ label: d.label, value: signupsByDayMap.get(d.key) ?? 0 }));

    const ggrByDayMap = new Map<string, { bet: number; payout: number; bonus: number }>();
    for (const row of ggrNgrByDayRows) {
      const key = dayKey(row.day);
      const entry = ggrByDayMap.get(key) ?? { bet: 0, payout: 0, bonus: 0 };
      const total = Number(row.total ?? BigInt(0));
      if (row.type === "BET") entry.bet = total;
      else if (row.type === "PAYOUT") entry.payout = total;
      else if (row.type === "BONUS") entry.bonus = total;
      ggrByDayMap.set(key, entry);
    }
    const ggrByDay = days.map((d) => {
      const entry = ggrByDayMap.get(d.key) ?? { bet: 0, payout: 0, bonus: 0 };
      const dayGgr = entry.bet - entry.payout;
      return { label: d.label, ggrCents: dayGgr, ngrCents: dayGgr - entry.bonus };
    });

    // ---- Gateways ----
    const credentialById = new Map(gatewayCredentials.map((g) => [g.id, g.name]));
    const gatewayVolume = gatewayVolumeRows
      .map((row) => ({
        label: credentialById.get(row.gatewayCredentialId) ?? "Desconhecido",
        valueCents: row._sum.amountCents ?? 0,
      }))
      .sort((a, b) => b.valueCents - a.valueCents);

    // ---- Alerts ----
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
      range: { start: start.toISOString(), end: end.toISOString() },
      kpis: {
        id: "dashboard-kpis",
        depositsCents: financial.depositsCents,
        depositsPrevCents: depositsPrevAgg._sum.amountCents ?? 0,
        withdrawalsCents: financial.withdrawalsCents,
        withdrawalsPrevCents: withdrawalsPrevAgg._sum.amountCents ?? 0,
        newPlayers: newSignups,
        newPlayersPrev: newSignupsPrev,
        ggrCents,
        ggrPrevCents,
      },
      ngrCents,
      ngrPrevCents,
      users,
      acquisition,
      financial,
      game,
      commercial,
      depositsByDay,
      signupsByDay,
      ggrByDay,
      gatewayVolume,
      connectedGateways,
      activeGateways,
      alerts,
    };
  }
}
