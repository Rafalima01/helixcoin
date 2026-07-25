import { describe, expect, it } from "vitest";
import {
  applyAffiliateSchema,
  createAffiliateLinkSchema,
  decideAffiliateApplicationSchema,
  decideCommissionSchema,
  affiliateSettingsUpdateSchema,
} from "@/modules/affiliate/validators/affiliate.validator";

describe("affiliate validators", () => {
  it("applyAffiliateSchema allows an empty body (no manager code, no pix key)", () => {
    expect(applyAffiliateSchema.safeParse({}).success).toBe(true);
  });

  it("createAffiliateLinkSchema requires a name with at least 2 chars", () => {
    expect(createAffiliateLinkSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(createAffiliateLinkSchema.safeParse({ name: "Instagram" }).success).toBe(true);
  });

  it("decideAffiliateApplicationSchema requires a reason for every action except APPROVE", () => {
    expect(decideAffiliateApplicationSchema.safeParse({ action: "APPROVE" }).success).toBe(true);
    expect(decideAffiliateApplicationSchema.safeParse({ action: "REJECT" }).success).toBe(false);
    expect(decideAffiliateApplicationSchema.safeParse({ action: "BLOCK", reason: "Fraude" }).success).toBe(true);
    expect(decideAffiliateApplicationSchema.safeParse({ action: "REQUEST_DOCUMENTS", reason: "CPF" }).success).toBe(true);
  });

  it("decideCommissionSchema requires a reason only for REJECT", () => {
    expect(decideCommissionSchema.safeParse({ action: "APPROVE" }).success).toBe(true);
    expect(decideCommissionSchema.safeParse({ action: "REJECT" }).success).toBe(false);
    expect(decideCommissionSchema.safeParse({ action: "REJECT", reason: "Depósito estornado" }).success).toBe(true);
  });

  it("affiliateSettingsUpdateSchema bounds percentages between 0 and 1", () => {
    expect(affiliateSettingsUpdateSchema.safeParse({ revShareLevel1Percent: 1.5 }).success).toBe(false);
    expect(affiliateSettingsUpdateSchema.safeParse({ revShareLevel1Percent: -0.1 }).success).toBe(false);
    expect(affiliateSettingsUpdateSchema.safeParse({ revShareLevel1Percent: 0.1 }).success).toBe(true);
  });
});
