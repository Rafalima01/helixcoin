import { eventBus } from "@/server/events";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";
import { PAYMENT_EVENTS, type DepositEventPayload } from "@/modules/payments/events/payments.events";
import type { IPromotionSettingsRepository, UpdatePromotionSettingsInput } from "@/modules/promotions/interfaces/promotion-settings-repository.interface";
import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import { signupBonusIdempotencyKey } from "@/modules/promotions/constants/promotions.constants";
import type { PromotionSettings } from "@/modules/promotions/entities/promotions.entity";

const SYSTEM_ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };

/**
 * Subscribes to the EXISTING PAYMENT_EVENTS.depositConfirmed (src/modules/payments,
 * zero changes there) — same convention as CommissionService.subscribeToDeposits().
 *
 * Only credits a bonus when ALL of: the user was flagged
 * eligibleForFirstDepositBonus at signup (?source=demo), this is their
 * first-ever confirmed deposit, and firstDepositBonusPercent > 0. The
 * percentage is always read fresh from PromotionSettings — never hardcoded
 * — so an admin change at /admin/promotions takes effect on the very next
 * deposit without a deploy.
 */
export class PromotionsService {
  constructor(
    private readonly settingsRepo: IPromotionSettingsRepository,
    private readonly walletService: WalletService,
    private readonly users: IUserRepository
  ) {}

  async getSettings(): Promise<PromotionSettings> {
    return this.settingsRepo.get();
  }

  async updateSettings(input: UpdatePromotionSettingsInput): Promise<PromotionSettings> {
    return this.settingsRepo.update(input);
  }

  /** Wired once at container-construction time (see container.ts) — not called directly in application code. */
  subscribeToDeposits(): () => void {
    return eventBus.subscribe<DepositEventPayload>(PAYMENT_EVENTS.depositConfirmed, async (event) => {
      await this.handleDepositConfirmed(event.payload);
    });
  }

  async handleDepositConfirmed(payload: DepositEventPayload): Promise<void> {
    const user = await this.users.findById(payload.userId);
    if (!user || !user.eligibleForFirstDepositBonus) return;

    const settings = await this.settingsRepo.get();
    if (settings.firstDepositBonusPercent <= 0) return;

    const isFtd = await this.isFirstConfirmedDeposit(payload.userId, payload.depositId);
    if (!isFtd) return;

    const amountCents = Math.round(payload.amountCents * settings.firstDepositBonusPercent);
    if (amountCents <= 0) return;

    await this.walletService.credit({
      userId: payload.userId,
      amountCents,
      type: "BONUS",
      account: "BONUS",
      origin: "promotions",
      originId: payload.depositId,
      idempotencyKey: signupBonusIdempotencyKey(payload.depositId),
      description: "Bônus de primeiro depósito — Modo Demo",
      metadata: { percentApplied: settings.firstDepositBonusPercent, depositAmountCents: payload.amountCents },
      actor: SYSTEM_ACTOR,
    });
  }

  /** Same logic as CommissionService.isFirstConfirmedDeposit — counts confirmed DEPOSIT transactions, no separate flag needed on Deposit/User. */
  private async isFirstConfirmedDeposit(userId: string, currentDepositId: string): Promise<boolean> {
    const { items, total } = await this.walletService.listTransactions({ userId, type: "DEPOSIT", page: 1, pageSize: 2 });
    if (total === 0) return true;
    if (total > 1) return false;
    return items[0]?.originId === currentDepositId;
  }
}
