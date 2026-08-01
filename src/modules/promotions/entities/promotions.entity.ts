/** One quick-amount button on the Deposit screen. Cents. Array order (in PromotionSettings.depositQuickAmounts) is display order. */
export interface DepositQuickAmount {
  amountCents: number;
  enabled: boolean;
  /** "Quente" / "Mais escolhido" style badge — admin-set only, never inferred from usage data (see PromotionsService validation). */
  highlightEnabled: boolean;
  highlightLabel: string | null;
}

/** Domain entity — single global row (id "global"). */
export interface PromotionSettings {
  id: string;
  firstDepositBonusPercent: number;
  /** Fraction, not percent (0.2 = 20%). Powers the "Garanta X% de bônus a partir do segundo depósito" copy on the Deposit screen. */
  secondDepositBonusPercent: number;
  depositPromoEnabled: boolean;
  depositPromoDurationSeconds: number;
  depositQuickAmounts: DepositQuickAmount[];
  updatedAt: Date;
}
