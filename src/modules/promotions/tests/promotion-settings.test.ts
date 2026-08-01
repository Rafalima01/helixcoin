import { describe, expect, it } from "vitest";
import { promotionSettingsUpdateSchema } from "@/modules/promotions/validators/promotions.validator";
import { InMemoryPromotionSettingsRepository } from "@/modules/promotions/repositories/promotion-settings.in-memory-repository";
import { toDepositOfferDto, toPromotionSettingsDto } from "@/modules/promotions/dto/promotions.dto";
import { DEFAULT_DEPOSIT_QUICK_AMOUNTS } from "@/modules/promotions/constants/promotions.constants";

describe("promotionSettingsUpdateSchema — deposit offer fields", () => {
  it("accepts a well-formed patch", () => {
    const result = promotionSettingsUpdateSchema.safeParse({
      secondDepositBonusPercent: 0.25,
      depositPromoEnabled: true,
      depositPromoDurationSeconds: 300,
      depositQuickAmounts: [
        { amountCents: 5000, enabled: true, highlightEnabled: false, highlightLabel: null },
        { amountCents: 10000, enabled: true, highlightEnabled: true, highlightLabel: "Quente" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate quick amounts", () => {
    const result = promotionSettingsUpdateSchema.safeParse({
      depositQuickAmounts: [
        { amountCents: 5000, enabled: true, highlightEnabled: false, highlightLabel: null },
        { amountCents: 5000, enabled: true, highlightEnabled: false, highlightLabel: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 quick amounts", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      amountCents: (i + 1) * 1000,
      enabled: true,
      highlightEnabled: false,
      highlightLabel: null,
    }));
    const result = promotionSettingsUpdateSchema.safeParse({ depositQuickAmounts: items });
    expect(result.success).toBe(false);
  });

  it("rejects a countdown duration outside the 30s–3600s range", () => {
    expect(promotionSettingsUpdateSchema.safeParse({ depositPromoDurationSeconds: 10 }).success).toBe(false);
    expect(promotionSettingsUpdateSchema.safeParse({ depositPromoDurationSeconds: 7200 }).success).toBe(false);
    expect(promotionSettingsUpdateSchema.safeParse({ depositPromoDurationSeconds: 600 }).success).toBe(true);
  });

  it("rejects a second-deposit bonus percent outside 0–1 (fraction, not percent)", () => {
    expect(promotionSettingsUpdateSchema.safeParse({ secondDepositBonusPercent: 1.5 }).success).toBe(false);
    expect(promotionSettingsUpdateSchema.safeParse({ secondDepositBonusPercent: 0.5 }).success).toBe(true);
  });
});

describe("InMemoryPromotionSettingsRepository — deposit offer defaults", () => {
  it("get() seeds the deposit promo defaults (enabled, 5min, default quick amounts)", async () => {
    const repo = new InMemoryPromotionSettingsRepository();
    const settings = await repo.get();
    expect(settings.depositPromoEnabled).toBe(true);
    expect(settings.depositPromoDurationSeconds).toBe(300);
    expect(settings.depositQuickAmounts).toEqual(DEFAULT_DEPOSIT_QUICK_AMOUNTS);
  });

  it("update() persists a partial patch without touching unrelated fields", async () => {
    const repo = new InMemoryPromotionSettingsRepository();
    await repo.get();
    const updated = await repo.update({ depositPromoEnabled: false });
    expect(updated.depositPromoEnabled).toBe(false);
    expect(updated.depositPromoDurationSeconds).toBe(300); // untouched
    expect(updated.firstDepositBonusPercent).toBe(0.5); // untouched
  });
});

describe("toDepositOfferDto — player-facing projection", () => {
  it("filters out disabled quick amounts and converts cents to reais", async () => {
    const repo = new InMemoryPromotionSettingsRepository();
    await repo.update({
      depositQuickAmounts: [
        { amountCents: 5000, enabled: true, highlightEnabled: false, highlightLabel: null },
        { amountCents: 10000, enabled: false, highlightEnabled: false, highlightLabel: null },
        { amountCents: 20000, enabled: true, highlightEnabled: true, highlightLabel: "Mais escolhido" },
      ],
    });
    const settings = await repo.get();
    const dto = toDepositOfferDto(settings);
    expect(dto.quickAmounts).toEqual([
      { amount: 50, highlightEnabled: false, highlightLabel: null },
      { amount: 200, highlightEnabled: true, highlightLabel: "Mais escolhido" },
    ]);
  });

  it("never exposes the admin-only shape (no `enabled` field, no id/updatedAt)", async () => {
    const repo = new InMemoryPromotionSettingsRepository();
    const settings = await repo.get();
    const dto = toDepositOfferDto(settings);
    expect(dto).not.toHaveProperty("id");
    expect(dto).not.toHaveProperty("updatedAt");
    for (const q of dto.quickAmounts) expect(q).not.toHaveProperty("enabled");
  });
});

describe("toPromotionSettingsDto — admin projection", () => {
  it("round-trips every deposit-offer field", async () => {
    const repo = new InMemoryPromotionSettingsRepository();
    const settings = await repo.get();
    const dto = toPromotionSettingsDto(settings);
    expect(dto.secondDepositBonusPercent).toBe(0.2);
    expect(dto.depositPromoEnabled).toBe(true);
    expect(dto.depositPromoDurationSeconds).toBe(300);
    expect(dto.depositQuickAmounts.length).toBeGreaterThan(0);
  });
});
