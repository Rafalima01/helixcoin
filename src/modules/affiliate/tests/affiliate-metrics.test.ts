import { describe, expect, it, vi, beforeEach } from "vitest";

const userCount = vi.fn();
const depositAggregate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: (...args: unknown[]) => userCount(...args) },
    deposit: { aggregate: (...args: unknown[]) => depositAggregate(...args) },
  },
}));

import { getAffiliateRawMetrics } from "@/modules/affiliate/services/affiliate-metrics";
import { InMemoryCommissionRepository } from "@/modules/affiliate/repositories/commission.in-memory-repository";

const AFFILIATE_ID = "aff-1";
const USER_ID = "user-1";

/**
 * getAffiliateRawMetrics is the shared helper both the affiliate's own
 * dashboard (affiliate.controller.ts) and the new admin performance
 * endpoint (affiliate-admin.controller.ts) call. Its commission math runs
 * over the injectable ICommissionRepository (tested here with the real
 * InMemoryCommissionRepository, no mocking needed), but referredCount/
 * ftdCount/referredDepositTotalCents go straight through `prisma` — same
 * as the pre-existing handleGetAffiliateDashboard code this was extracted
 * from — so those three are exercised here with a mocked @/lib/prisma
 * module rather than a real database (Postgres is unavailable in this
 * environment; this is the closest safe substitute — see the accompanying
 * report's "browser/DB" limitations section).
 */
describe("getAffiliateRawMetrics", () => {
  beforeEach(() => {
    userCount.mockReset();
    depositAggregate.mockReset();
  });

  it("FTD (ftdCount) is a DISTINCT-USER query, not a deposit-count query — proves it is NOT the same thing as confirmedDeposits", async () => {
    const commissions = new InMemoryCommissionRepository();
    // referredCount call returns 10, the FTD (deposits: some PAID) call returns 4 —
    // two DIFFERENT prisma.user.count invocations with different where clauses,
    // asserted below by their call order/arguments.
    userCount.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
    depositAggregate.mockResolvedValueOnce({ _sum: { amountCents: 123456 } });

    const m = await getAffiliateRawMetrics(commissions, AFFILIATE_ID, USER_ID);

    expect(m.referredCount).toBe(10);
    expect(m.ftdCount).toBe(4);
    expect(m.referredDepositTotalCents).toBe(123456);

    // First call: plain referredById count (no deposit filter) — "Cadastros".
    expect(userCount).toHaveBeenNthCalledWith(1, { where: { referredById: USER_ID } });
    // Second call: referredById AND at least one PAID deposit — the actual
    // FTD definition (distinct users, never counts a user's 2nd/3rd deposit).
    expect(userCount).toHaveBeenNthCalledWith(2, {
      where: { referredById: USER_ID, deposits: { some: { status: "PAID" } } },
    });
  });

  it("a referred user who deposits 3 times only ever counts once toward FTD, while confirmedDeposits (distinct DEPOSITS) counts all 3 — the exact trap the metrics must not fall into", async () => {
    const commissions = new InMemoryCommissionRepository();
    // 3 separate REVSHARE_DEPOSIT commissions for the SAME affiliate, from 3
    // distinct deposits made by the SAME referred user (originUserId constant).
    for (const triggerId of ["dep-1", "dep-2", "dep-3"]) {
      await commissions.create({
        affiliateId: AFFILIATE_ID,
        payeeUserId: USER_ID,
        level: 1,
        originUserId: "referred-user-x",
        sourceType: "REVSHARE_DEPOSIT",
        triggerId,
        amountCents: 500,
        percentApplied: 0.05,
        status: "AVAILABLE",
      });
    }

    // The repository-derived confirmedDeposits counts distinct triggerIds (3).
    // ftdCount comes from the mocked prisma call below and must reflect only
    // 1 distinct referred user, independent of confirmedDeposits.
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    depositAggregate.mockResolvedValueOnce({ _sum: { amountCents: 1500 } });

    const m = await getAffiliateRawMetrics(commissions, AFFILIATE_ID, USER_ID);

    expect(m.confirmedDeposits).toBe(3); // 3 distinct deposits generated a commission
    expect(m.ftdCount).toBe(1); // but only 1 distinct referred user — the true FTD count
  });

  it("commissionTotalCents/balanceAvailableCents/balanceLockedCents reflect real commission data from the repository", async () => {
    const commissions = new InMemoryCommissionRepository();
    await commissions.create({
      affiliateId: AFFILIATE_ID,
      payeeUserId: USER_ID,
      level: 1,
      originUserId: "referred-user-y",
      sourceType: "REVSHARE_DEPOSIT",
      triggerId: "dep-available",
      amountCents: 700,
      percentApplied: 0.05,
      status: "AVAILABLE",
    });
    await commissions.create({
      affiliateId: AFFILIATE_ID,
      payeeUserId: USER_ID,
      level: 1,
      originUserId: "referred-user-z",
      sourceType: "REVSHARE_DEPOSIT",
      triggerId: "dep-locked",
      amountCents: 300,
      percentApplied: 0.05,
      status: "LOCKED",
    });

    userCount.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    depositAggregate.mockResolvedValueOnce({ _sum: { amountCents: 20000 } });

    const m = await getAffiliateRawMetrics(commissions, AFFILIATE_ID, USER_ID);

    expect(m.commissionTotalCents).toBe(1000); // 700 + 300, every status
    expect(m.balanceAvailableCents).toBe(700);
    expect(m.balanceLockedCents).toBe(300);
  });

  /**
   * The "Indique e Ganhe" regression fix — a regular account with NO
   * AffiliateProfile (affiliateId=null) must still get its real referral
   * numbers (referredCount/referredDepositTotalCents come from `userId`
   * alone, not from an AffiliateProfile), while every commission-shaped
   * figure is structurally zero (Commission rows are always keyed by a real
   * affiliateId — there's nothing to sum) and no commissionRepository call
   * is even attempted.
   */
  it("affiliateId=null (no AffiliateProfile): real referredCount/referredDepositTotalCents, zero commission figures, no commissionRepository calls", async () => {
    const commissions = new InMemoryCommissionRepository();
    const sumSpy = vi.spyOn(commissions, "sumAmountCents");
    const countConfirmedSpy = vi.spyOn(commissions, "countConfirmedDeposits");

    userCount.mockResolvedValueOnce(3).mockResolvedValueOnce(1); // referredCount=3, ftdCount=1
    depositAggregate.mockResolvedValueOnce({ _sum: { amountCents: 5000 } });

    const m = await getAffiliateRawMetrics(commissions, null, USER_ID);

    expect(m.referredCount).toBe(3);
    expect(m.ftdCount).toBe(1);
    expect(m.referredDepositTotalCents).toBe(5000);
    expect(m.commissionTotalCents).toBe(0);
    expect(m.commissionTodayCents).toBe(0);
    expect(m.commission7dCents).toBe(0);
    expect(m.commission30dCents).toBe(0);
    expect(m.balanceAvailableCents).toBe(0);
    expect(m.balanceLockedCents).toBe(0);
    expect(m.confirmedDeposits).toBe(0);
    expect(sumSpy).not.toHaveBeenCalled();
    expect(countConfirmedSpy).not.toHaveBeenCalled();
  });
});
