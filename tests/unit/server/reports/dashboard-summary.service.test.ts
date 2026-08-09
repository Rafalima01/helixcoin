import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Generic in-memory fake for the handful of Prisma calls
 * DashboardSummaryService.build() actually issues. Every aggregate/count/
 * groupBy/findMany call is routed through matchesWhere() against a fixture
 * array, so a query really has to carry the right `where` clause (e.g.
 * `user: { isDemo: false }`) to get the filtered result — this is what lets
 * the tests below catch a missing isDemo filter instead of just asserting
 * "was called with some object".
 *
 * Everything the vi.mock("@/lib/prisma", ...) factory below closes over
 * must live inside vi.hoisted() — vi.mock factories run during import
 * hoisting, before any of this file's own top-level `const`s would
 * otherwise have run.
 */
const { depositRows, withdrawRows, walletTxRows, commissionRows, usersById, resetFixtures, genericAggregate } = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  function getPath(row: Row, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => (acc as Row | undefined)?.[key], row);
  }

  function matchesWhere(row: Row, where: Record<string, unknown> | undefined, usersById: Map<string, { isDemo: boolean }>): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (key === "createdAt" || key === "confirmedAt" || key === "processedAt") {
        const val = row[key] as Date | undefined;
        const range = cond as { gte?: Date; lt?: Date };
        if (!val) return false;
        if (range.gte && val < range.gte) return false;
        if (range.lt && val >= range.lt) return false;
      } else if (key === "user" || key === "payeeUser") {
        const userIdField = key === "user" ? "userId" : "payeeUserId";
        const user = usersById.get(row[userIdField] as string);
        const isDemoCond = (cond as { isDemo?: boolean }).isDemo;
        if (isDemoCond !== undefined && (!user || user.isDemo !== isDemoCond)) return false;
      } else if (typeof cond === "object" && cond !== null && "in" in (cond as object)) {
        const allowed = (cond as { in: unknown[] }).in;
        if (!allowed.includes(getPath(row, key))) return false;
      } else if (getPath(row, key) !== cond) {
        return false;
      }
    }
    return true;
  }

  function genericAggregate(
    rows: Row[],
    args: { where?: Record<string, unknown>; _sum?: Record<string, boolean>; _avg?: Record<string, boolean>; _max?: Record<string, boolean> },
    usersById: Map<string, { isDemo: boolean }>
  ) {
    const matched = rows.filter((r) => matchesWhere(r, args.where, usersById));
    const out: Record<string, unknown> = { _count: matched.length };
    if (args._sum) {
      out._sum = Object.fromEntries(
        Object.keys(args._sum).map((field) => [field, matched.length ? matched.reduce((acc, r) => acc + Number(r[field] ?? 0), 0) : null])
      );
    }
    if (args._avg) {
      out._avg = Object.fromEntries(
        Object.keys(args._avg).map((field) => [field, matched.length ? matched.reduce((acc, r) => acc + Number(r[field] ?? 0), 0) / matched.length : null])
      );
    }
    if (args._max) {
      out._max = Object.fromEntries(
        Object.keys(args._max).map((field) => [field, matched.length ? Math.max(...matched.map((r) => Number(r[field] ?? 0))) : null])
      );
    }
    return out;
  }

  const depositRows: Row[] = [];
  const withdrawRows: Row[] = [];
  const walletTxRows: Row[] = [];
  const commissionRows: Row[] = [];
  const usersById = new Map<string, { isDemo: boolean }>();

  function resetFixtures() {
    depositRows.length = 0;
    withdrawRows.length = 0;
    walletTxRows.length = 0;
    commissionRows.length = 0;
    usersById.clear();
    usersById.set("real-1", { isDemo: false });
    usersById.set("demo-1", { isDemo: true });
    usersById.set("payee-1", { isDemo: false });
  }

  return { depositRows, withdrawRows, walletTxRows, commissionRows, usersById, resetFixtures, genericAggregate };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deposit: {
      aggregate: vi.fn((args: Record<string, unknown>) => Promise.resolve(genericAggregate(depositRows, args as never, usersById))),
      groupBy: vi.fn(() => Promise.resolve([])),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    withdraw: {
      aggregate: vi.fn((args: Record<string, unknown>) => Promise.resolve(genericAggregate(withdrawRows, args as never, usersById))),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    walletTransaction: {
      aggregate: vi.fn((args: Record<string, unknown>) => Promise.resolve(genericAggregate(walletTxRows, args as never, usersById))),
    },
    commission: {
      aggregate: vi.fn((args: Record<string, unknown>) => Promise.resolve(genericAggregate(commissionRows, args as never, usersById))),
    },
    match: {
      aggregate: vi.fn((args: Record<string, unknown>) => Promise.resolve(genericAggregate([], args as never, usersById))),
      groupBy: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    },
    session: { groupBy: vi.fn(() => Promise.resolve([])) },
    user: { count: vi.fn(() => Promise.resolve(0)) },
    affiliateProfile: {
      findMany: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    },
    managerProfile: { count: vi.fn(() => Promise.resolve(0)) },
    gatewayCredential: {
      count: vi.fn(() => Promise.resolve(0)),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    $queryRaw: vi.fn(() => Promise.resolve([])),
  },
}));

import { DashboardSummaryService } from "@/server/reports/dashboard-summary.service";

const RANGE = { start: new Date("2026-08-02T00:00:00.000Z"), end: new Date("2026-08-09T00:00:00.000Z") };
const IN_RANGE = new Date("2026-08-05T12:00:00.000Z");

describe("DashboardSummaryService.build — GGR isDemo exclusion", () => {
  beforeEach(resetFixtures);

  it("never lets a demo account's BET/PAYOUT/BONUS contaminate GGR/NGR", async () => {
    walletTxRows.push(
      { userId: "real-1", type: "BET", status: "COMPLETED", amount: 6500, createdAt: IN_RANGE },
      { userId: "real-1", type: "PAYOUT", status: "COMPLETED", amount: 3536, createdAt: IN_RANGE },
      // Demo account: much larger volume, must not move the needle at all.
      { userId: "demo-1", type: "BET", status: "COMPLETED", amount: 37500, createdAt: IN_RANGE },
      { userId: "demo-1", type: "PAYOUT", status: "COMPLETED", amount: 6156, createdAt: IN_RANGE }
    );

    const summary = await new DashboardSummaryService().build(RANGE);

    expect(summary.financial.ggrCents).toBe(6500 - 3536);
    expect(summary.kpis.ggrCents).toBe(6500 - 3536);
  });
});

describe("DashboardSummaryService.build — Lucro Líquido Realizado", () => {
  beforeEach(resetFixtures);

  it("commission LOCKED does not reduce the realized net profit", async () => {
    depositRows.push({ userId: "real-1", status: "PAID", amountCents: 10000, confirmedAt: IN_RANGE });
    commissionRows.push({ payeeUserId: "payee-1", sourceType: "MANAGER_SPREAD", status: "LOCKED", amountCents: 3000, createdAt: IN_RANGE });

    const summary = await new DashboardSummaryService().build(RANGE);

    expect(summary.financial.netProfitCents).toBe(10000);
  });

  it("commission AVAILABLE does not reduce the realized net profit", async () => {
    depositRows.push({ userId: "real-1", status: "PAID", amountCents: 10000, confirmedAt: IN_RANGE });
    commissionRows.push({ payeeUserId: "payee-1", sourceType: "REVSHARE_DEPOSIT", status: "AVAILABLE", amountCents: 2000, createdAt: IN_RANGE });

    const summary = await new DashboardSummaryService().build(RANGE);

    expect(summary.financial.netProfitCents).toBe(10000);
  });

  it("a PENDING withdraw does not reduce the realized net profit", async () => {
    depositRows.push({ userId: "real-1", status: "PAID", amountCents: 10000, confirmedAt: IN_RANGE });
    withdrawRows.push({ userId: "real-1", status: "PENDING", amountCents: 4000, processedAt: IN_RANGE });

    const summary = await new DashboardSummaryService().build(RANGE);

    expect(summary.financial.netProfitCents).toBe(10000);
  });

  it("an APPROVED withdraw reduces the realized net profit", async () => {
    depositRows.push({ userId: "real-1", status: "PAID", amountCents: 10000, confirmedAt: IN_RANGE });
    withdrawRows.push({ userId: "real-1", status: "APPROVED", amountCents: 4000, processedAt: IN_RANGE });

    const summary = await new DashboardSummaryService().build(RANGE);

    expect(summary.financial.netProfitCents).toBe(6000);
  });

  it("a demo account's deposits/withdraws never enter the realized net profit", async () => {
    depositRows.push({ userId: "real-1", status: "PAID", amountCents: 10000, confirmedAt: IN_RANGE });
    // Would swing net profit if the isDemo filter were missing.
    depositRows.push({ userId: "demo-1", status: "PAID", amountCents: 99999, confirmedAt: IN_RANGE });
    withdrawRows.push({ userId: "demo-1", status: "APPROVED", amountCents: 50000, processedAt: IN_RANGE });

    const summary = await new DashboardSummaryService().build(RANGE);

    expect(summary.financial.depositsCents).toBe(10000);
    expect(summary.financial.withdrawalsCents).toBe(0);
    expect(summary.financial.netProfitCents).toBe(10000);
  });

  it("R$100 scenario: pending commissions and an unpaid player payout never touch realized profit until actually withdrawn", async () => {
    depositRows.push({ userId: "real-1", status: "PAID", amountCents: 10000, confirmedAt: IN_RANGE });
    commissionRows.push(
      { payeeUserId: "payee-1", sourceType: "MANAGER_SPREAD", status: "LOCKED", amountCents: 3000, createdAt: IN_RANGE },
      { payeeUserId: "payee-1", sourceType: "REVSHARE_DEPOSIT", status: "AVAILABLE", amountCents: 2000, createdAt: IN_RANGE }
    );
    // A player win sitting in the wallet, not yet cashed out — must not reduce realized profit either.
    walletTxRows.push({ userId: "real-1", type: "PAYOUT", status: "COMPLETED", amount: 5000, createdAt: IN_RANGE });

    const service = new DashboardSummaryService();

    let summary = await service.build(RANGE);
    expect(summary.financial.netProfitCents).toBe(10000); // R$100 — nothing withdrawn yet

    withdrawRows.push({ userId: "real-1", status: "APPROVED", amountCents: 3000, processedAt: IN_RANGE });
    summary = await service.build(RANGE);
    expect(summary.financial.netProfitCents).toBe(7000); // R$70 — manager's R$30 paid out

    withdrawRows.push({ userId: "real-1", status: "APPROVED", amountCents: 2000, processedAt: IN_RANGE });
    summary = await service.build(RANGE);
    expect(summary.financial.netProfitCents).toBe(5000); // R$50 — affiliate's R$20 paid out

    withdrawRows.push({ userId: "real-1", status: "APPROVED", amountCents: 5000, processedAt: IN_RANGE });
    summary = await service.build(RANGE);
    expect(summary.financial.netProfitCents).toBe(0); // R$0 — player's R$50 win paid out
  });
});
