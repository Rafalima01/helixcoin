import type { AffiliateSettings as PrismaAffiliateSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IAffiliateSettingsRepository,
  UpdateAffiliateSettingsInput,
} from "@/modules/affiliate/interfaces/affiliate-settings-repository.interface";
import type { AffiliateSettings } from "@/modules/affiliate/entities/affiliate.entity";
import { DEFAULT_AFFILIATE_SETTINGS_ID } from "@/modules/affiliate/constants/affiliate.constants";

function toEntity(row: PrismaAffiliateSettings): AffiliateSettings {
  return {
    id: row.id,
    revShareLevel1Percent: row.revShareLevel1Percent,
    revShareLevel2Percent: row.revShareLevel2Percent,
    revShareLevel3Percent: row.revShareLevel3Percent,
    autoApproveCommissions: row.autoApproveCommissions,
    requireManagerApprovalForAffiliates: row.requireManagerApprovalForAffiliates,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAffiliateSettingsRepository implements IAffiliateSettingsRepository {
  async get(): Promise<AffiliateSettings> {
    const row = await prisma.affiliateSettings.upsert({
      where: { id: DEFAULT_AFFILIATE_SETTINGS_ID },
      update: {},
      create: { id: DEFAULT_AFFILIATE_SETTINGS_ID },
    });
    return toEntity(row);
  }

  async update(input: UpdateAffiliateSettingsInput): Promise<AffiliateSettings> {
    const row = await prisma.affiliateSettings.upsert({
      where: { id: DEFAULT_AFFILIATE_SETTINGS_ID },
      update: { ...input },
      create: { id: DEFAULT_AFFILIATE_SETTINGS_ID, ...input },
    });
    return toEntity(row);
  }
}
