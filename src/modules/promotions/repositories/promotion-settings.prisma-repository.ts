import type { PromotionSettings as PrismaPromotionSettings, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPromotionSettingsRepository,
  UpdatePromotionSettingsInput,
} from "@/modules/promotions/interfaces/promotion-settings-repository.interface";
import type { DepositQuickAmount, PromotionSettings } from "@/modules/promotions/entities/promotions.entity";
import { DEFAULT_PROMOTION_SETTINGS_ID, DEFAULT_DEPOSIT_QUICK_AMOUNTS } from "@/modules/promotions/constants/promotions.constants";

/** Defensive runtime guard for the Json column — malformed/legacy rows fall back to defaults instead of throwing. */
function parseQuickAmounts(value: Prisma.JsonValue | null): DepositQuickAmount[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_DEPOSIT_QUICK_AMOUNTS;
  const parsed: DepositQuickAmount[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    if (typeof row.amountCents !== "number") continue;
    parsed.push({
      amountCents: row.amountCents,
      enabled: typeof row.enabled === "boolean" ? row.enabled : true,
      highlightEnabled: typeof row.highlightEnabled === "boolean" ? row.highlightEnabled : false,
      highlightLabel: typeof row.highlightLabel === "string" ? row.highlightLabel : null,
    });
  }
  return parsed.length > 0 ? parsed : DEFAULT_DEPOSIT_QUICK_AMOUNTS;
}

function toEntity(row: PrismaPromotionSettings): PromotionSettings {
  return {
    id: row.id,
    firstDepositBonusPercent: row.firstDepositBonusPercent,
    secondDepositBonusPercent: row.secondDepositBonusPercent,
    depositPromoEnabled: row.depositPromoEnabled,
    depositPromoDurationSeconds: row.depositPromoDurationSeconds,
    depositQuickAmounts: parseQuickAmounts(row.depositQuickAmounts),
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
    const { depositQuickAmounts, ...rest } = input;
    const data = {
      ...rest,
      ...(depositQuickAmounts !== undefined
        ? { depositQuickAmounts: depositQuickAmounts as unknown as Prisma.InputJsonValue }
        : {}),
    };
    const row = await prisma.promotionSettings.upsert({
      where: { id: DEFAULT_PROMOTION_SETTINGS_ID },
      update: data,
      create: { id: DEFAULT_PROMOTION_SETTINGS_ID, ...data },
    });
    return toEntity(row);
  }
}
