import type { PromotionSettings } from "@/modules/promotions/entities/promotions.entity";

export interface PromotionSettingsDto {
  id: string;
  firstDepositBonusPercent: number;
  updatedAt: string;
}

export function toPromotionSettingsDto(entity: PromotionSettings): PromotionSettingsDto {
  return {
    id: entity.id,
    firstDepositBonusPercent: entity.firstDepositBonusPercent,
    updatedAt: entity.updatedAt.toISOString(),
  };
}
