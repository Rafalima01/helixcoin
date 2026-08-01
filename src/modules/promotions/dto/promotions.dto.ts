import type { DepositQuickAmount, PromotionSettings } from "@/modules/promotions/entities/promotions.entity";

export interface DepositQuickAmountDto {
  amountCents: number;
  enabled: boolean;
  highlightEnabled: boolean;
  highlightLabel: string | null;
}

function toQuickAmountDto(item: DepositQuickAmount): DepositQuickAmountDto {
  return {
    amountCents: item.amountCents,
    enabled: item.enabled,
    highlightEnabled: item.highlightEnabled,
    highlightLabel: item.highlightLabel,
  };
}

export interface PromotionSettingsDto {
  id: string;
  firstDepositBonusPercent: number;
  secondDepositBonusPercent: number;
  depositPromoEnabled: boolean;
  depositPromoDurationSeconds: number;
  depositQuickAmounts: DepositQuickAmountDto[];
  updatedAt: string;
}

export function toPromotionSettingsDto(entity: PromotionSettings): PromotionSettingsDto {
  return {
    id: entity.id,
    firstDepositBonusPercent: entity.firstDepositBonusPercent,
    secondDepositBonusPercent: entity.secondDepositBonusPercent,
    depositPromoEnabled: entity.depositPromoEnabled,
    depositPromoDurationSeconds: entity.depositPromoDurationSeconds,
    depositQuickAmounts: entity.depositQuickAmounts.map(toQuickAmountDto),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/** GET /api/promotions/deposit-offer (player-facing) — only what the Deposit screen needs: reais amounts, enabled-only, already ordered. Never exposes admin-only shape. */
export interface DepositOfferDto {
  promoEnabled: boolean;
  promoDurationSeconds: number;
  secondDepositBonusPercent: number;
  quickAmounts: Array<{
    amount: number;
    highlightEnabled: boolean;
    highlightLabel: string | null;
  }>;
}

export function toDepositOfferDto(entity: PromotionSettings): DepositOfferDto {
  return {
    promoEnabled: entity.depositPromoEnabled,
    promoDurationSeconds: entity.depositPromoDurationSeconds,
    secondDepositBonusPercent: entity.secondDepositBonusPercent,
    quickAmounts: entity.depositQuickAmounts
      .filter((a) => a.enabled)
      .map((a) => ({
        amount: a.amountCents / 100,
        highlightEnabled: a.highlightEnabled,
        highlightLabel: a.highlightLabel,
      })),
  };
}
