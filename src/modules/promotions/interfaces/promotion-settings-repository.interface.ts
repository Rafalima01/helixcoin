import type { PromotionSettings } from "@/modules/promotions/entities/promotions.entity";

export interface UpdatePromotionSettingsInput {
  firstDepositBonusPercent?: number;
}

/** Single global row (id "global") — `get()` creates it with defaults on first read, same pattern as AffiliateSettings. */
export interface IPromotionSettingsRepository {
  get(): Promise<PromotionSettings>;
  update(input: UpdatePromotionSettingsInput): Promise<PromotionSettings>;
}
