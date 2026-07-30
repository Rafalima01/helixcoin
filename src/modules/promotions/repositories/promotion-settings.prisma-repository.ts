import type { PromotionSettings as PrismaPromotionSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPromotionSettingsRepository,
  UpdatePromotionSettingsInput,
} from "@/modules/promotions/interfaces/promotion-settings-repository.interface";
import type { PromotionSettings } from "@/modules/promotions/entities/promotions.entity";
import { DEFAULT_PROMOTION_SETTINGS_ID } from "@/modules/promotions/constants/promotions.constants";

function toEntity(row: PrismaPromotionSettings): PromotionSettings {
  return {
    id: row.id,
    firstDepositBonusPercent: row.firstDepositBonusPercent,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPromotionSettingsRepository implements IPromotionSettingsRepository {
  async get(): Promise<PromotionSettings> {
    const row = await prisma.promotionSettings.upsert({
      where: { id: DEFAULT_PROMOTION_SETTINGS_ID },
      update: {},
      create: { id: DEFAULT_PROMOTION_SETTINGS_ID },
    });
    return toEntity(row);
  }

  async update(input: UpdatePromotionSettingsInput): Promise<PromotionSettings> {
    const row = await prisma.promotionSettings.upsert({
      where: { id: DEFAULT_PROMOTION_SETTINGS_ID },
      update: { ...input },
      create: { id: DEFAULT_PROMOTION_SETTINGS_ID, ...input },
    });
    return toEntity(row);
  }
}
