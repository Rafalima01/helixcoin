import type { AffiliateSettings } from "@/modules/affiliate/entities/affiliate.entity";

export interface UpdateAffiliateSettingsInput {
  revShareLevel1Percent?: number;
  revShareLevel2Percent?: number;
  revShareLevel3Percent?: number;
  cpaAmountCents?: number;
  autoApproveCommissions?: boolean;
  requireManagerApprovalForAffiliates?: boolean;
}

/** Single global row (id "global") — `get()` creates it with defaults on first read, same pattern as GameConfig/PaymentSettings. */
export interface IAffiliateSettingsRepository {
  get(): Promise<AffiliateSettings>;
  update(input: UpdateAffiliateSettingsInput): Promise<AffiliateSettings>;
}
