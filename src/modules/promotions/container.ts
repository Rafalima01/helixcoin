import { walletContainer } from "@/modules/wallet/container";
import { identityContainer } from "@/modules/identity/container";
import { PromotionsService } from "@/modules/promotions/services/promotions.service";
import { PrismaPromotionSettingsRepository } from "@/modules/promotions/repositories/promotion-settings.prisma-repository";

const settings = new PrismaPromotionSettingsRepository();

const promotionsService = new PromotionsService(settings, walletContainer.walletService, identityContainer.userRepository);

// Wires the bonus engine to the existing payments deposit-confirmed event
// exactly once, at module load — same convention as
// affiliateContainer's commissionService.subscribeToDeposits().
promotionsService.subscribeToDeposits();

export const promotionsContainer = {
  promotionsService,
};
