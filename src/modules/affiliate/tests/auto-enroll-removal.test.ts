import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: {
    system: "system",
    accountApproved: "account_approved",
    accountBlocked: "account_blocked",
    documentsPending: "documents_pending",
    newCommission: "new_commission",
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { managerProfile: { findUnique: vi.fn().mockResolvedValue(null) } },
}));

import { buildAffiliateTestHarness } from "@/modules/affiliate/tests/test-helpers";
import type { DecisionActor } from "@/modules/affiliate/services/affiliate.service";
import { hasRole, ROLE_HIERARCHY } from "@/server/auth/rbac";
import { NotFoundError } from "@/server/errors";

const ADMIN_ACTOR: DecisionActor = { actorId: "admin-1", actorRole: "ADMIN" };

/**
 * Locks in the product decision that removed automatic AffiliateProfile
 * creation (previously AffiliateService.autoEnroll, called from both
 * auth.controller.ts's handleRegister at signup AND
 * affiliate.controller.ts's handleGetMyAffiliateProfile as a self-heal when
 * opening the "Indique" tab — both call sites were deleted, see those files'
 * updated doc comments).
 *
 * The two removed call sites are Next.js route-controller functions
 * (auth.controller.ts / affiliate.controller.ts) that import their
 * container as a hardcoded Prisma-backed singleton — this codebase has no
 * existing convention or harness for unit-testing that HTTP layer directly
 * (every other test in identity/affiliate only exercises the service layer
 * over in-memory repositories, see test-helpers.ts). These tests instead
 * lock in the SERVICE-LAYER guarantee those controllers now rely on: a
 * user who is never explicitly promoted has no AffiliateProfile, no matter
 * how many times their profile is looked up. Removing the controller calls
 * was verified by direct code reading (both call sites no longer exist —
 * see auth.controller.ts and affiliate.controller.ts's handleGetMyAffiliateProfile).
 */
describe("Affiliate auto-creation is no longer automatic", () => {
  it("a brand-new user (equivalent to a fresh signup) has no AffiliateProfile", async () => {
    const { affiliates } = buildAffiliateTestHarness();
    const profile = await affiliates.findByUserId("brand-new-user");
    expect(profile).toBeNull();
  });

  it("a brand-new user does not show up in the admin Afiliados listing", async () => {
    const { affiliates } = buildAffiliateTestHarness();
    const all = await affiliates.listAdmin({ page: 1, pageSize: 100 });
    expect(all.items.find((r) => r.userId === "brand-new-user")).toBeUndefined();
  });

  it("looking up a profile that doesn't exist (equivalent to opening 'Indique') throws instead of silently creating one — repeated lookups never create a profile as a side effect", async () => {
    const { affiliateService, affiliates } = buildAffiliateTestHarness();

    await expect(affiliateService.getProfile("some-user")).rejects.toThrow(NotFoundError);
    await expect(affiliateService.getProfile("some-user")).rejects.toThrow(NotFoundError);
    await expect(affiliateService.getProfile("some-user")).rejects.toThrow(NotFoundError);

    const all = await affiliates.listAdmin({ page: 1, pageSize: 100 });
    expect(all.items.filter((r) => r.userId === "some-user")).toHaveLength(0);
  });

  it("'Transformar em afiliado' (adminCreateDirect) still creates an APPROVED AffiliateProfile with an admin actor", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const created = await affiliateService.adminCreateDirect("promoted-user", ADMIN_ACTOR);

    expect(created.status).toBe("APPROVED");
    expect(created.userId).toBe("promoted-user");
  });

  it("after 'Transformar em afiliado', the user appears in the admin Afiliados listing", async () => {
    const { affiliateService, affiliates } = buildAffiliateTestHarness();
    const created = await affiliateService.adminCreateDirect("promoted-user-2", ADMIN_ACTOR);

    const all = await affiliates.listAdmin({ page: 1, pageSize: 100 });
    expect(all.items.some((r) => r.id === created.id && r.userId === "promoted-user-2")).toBe(true);
  });

  it("AFFILIATE is not part of ROLE_HIERARCHY — an affiliate account can never pass withRole(...ROLE_HIERARCHY), the same gate every /api/admin/affiliate/* route (including the new performance endpoint) uses", () => {
    expect(hasRole("AFFILIATE", ROLE_HIERARCHY)).toBe(false);
    expect(hasRole("USER", ROLE_HIERARCHY)).toBe(false);
    expect(hasRole("ADMIN", ROLE_HIERARCHY)).toBe(true);
  });
});
