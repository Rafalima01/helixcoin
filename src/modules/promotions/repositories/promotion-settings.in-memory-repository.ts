import type {
  IPromotionSettingsRepository,
  UpdatePromotionSettingsInput,
} from "@/modules/promotions/interfaces/promotion-settings-repository.interface";
import type { PromotionSettings } from "@/modules/promotions/entities/promotions.entity";
import { DEFAULT_PROMOTION_SETTINGS_ID, DEFAULT_DEPOSIT_QUICK_AMOUNTS } from "@/modules/promotions/constants/promotions.constants";

function defaults(): PromotionSettings {
  return {
    id: DEFAULT_PROMOTION_SETTINGS_ID,
    firstDepositBonusPercent: 0.5,
    secondDepositBonusPercent: 0.2,
    depositPromoEnabled: true,
    depositPromoDurationSeconds: 300,
    depositQuickAmounts: DEFAULT_DEPOSIT_QUICK_AMOUNTS,
    updatedAt: new Date(),
  };
}

export class InMemoryPromotionSettingsRepository implements IPromotionSettingsRepository {
  private row: PromotionSettings | null = null;

  async get(): Promise<PromotionSettings> {
    if (!this.row) this.row = defaults();
    return this.row;
  }

  async update(input: UpdatePromotionSettingsInput): Promise<PromotionSettings> {
    const current = await this.get();
    this.row = { ...current, ...input, updatedAt: new Date() };
    return this.row;
  }
}
