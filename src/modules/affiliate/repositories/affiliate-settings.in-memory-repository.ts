import type {
  IAffiliateSettingsRepository,
  UpdateAffiliateSettingsInput,
} from "@/modules/affiliate/interfaces/affiliate-settings-repository.interface";
import type { AffiliateSettings } from "@/modules/affiliate/entities/affiliate.entity";
import { DEFAULT_AFFILIATE_SETTINGS_ID } from "@/modules/affiliate/constants/affiliate.constants";

function defaults(): AffiliateSettings {
  return {
    id: DEFAULT_AFFILIATE_SETTINGS_ID,
    revShareLevel1Percent: 0.05,
    revShareLevel2Percent: 0.02,
    revShareLevel3Percent: 0.01,
    autoApproveCommissions: true,
    requireManagerApprovalForAffiliates: false,
    updatedAt: new Date(),
  };
}

export class InMemoryAffiliateSettingsRepository implements IAffiliateSettingsRepository {
  private row: AffiliateSettings | null = null;

  async get(): Promise<AffiliateSettings> {
    if (!this.row) this.row = defaults();
    return this.row;
  }

  async update(input: UpdateAffiliateSettingsInput): Promise<AffiliateSettings> {
    const current = await this.get();
    this.row = { ...current, ...input, updatedAt: new Date() };
    return this.row;
  }
}
