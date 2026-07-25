import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { AffiliateService } from "@/modules/affiliate/services/affiliate.service";
import { AffiliateLinkService } from "@/modules/affiliate/services/affiliate-link.service";
import { CommissionService } from "@/modules/affiliate/services/commission.service";
import { InMemoryAffiliateRepository } from "@/modules/affiliate/repositories/affiliate.in-memory-repository";
import { InMemoryAffiliateLinkRepository } from "@/modules/affiliate/repositories/affiliate-link.in-memory-repository";
import { InMemoryCommissionRepository } from "@/modules/affiliate/repositories/commission.in-memory-repository";
import { InMemoryAffiliateSettingsRepository } from "@/modules/affiliate/repositories/affiliate-settings.in-memory-repository";
import { InMemoryUserReferralRepository } from "@/modules/affiliate/repositories/user-referral.in-memory-repository";
import { InMemoryManagerRepository } from "@/modules/manager/repositories/manager.in-memory-repository";

/** Fully-wired affiliate module over in-memory repositories — mirrors src/modules/payments/tests/test-helpers.ts's buildPaymentTestHarness. commission.service's subscribeToDeposits() is deliberately NOT called — tests call handleDepositConfirmed(...) directly instead of going through the real eventBus, for determinism. */
export function buildAffiliateTestHarness() {
  const wallets = new InMemoryWalletRepository();
  const walletService = new WalletService(wallets);

  const affiliates = new InMemoryAffiliateRepository();
  const links = new InMemoryAffiliateLinkRepository();
  const commissions = new InMemoryCommissionRepository();
  const settingsRepo = new InMemoryAffiliateSettingsRepository();
  const userReferrals = new InMemoryUserReferralRepository();
  const managers = new InMemoryManagerRepository();

  const affiliateService = new AffiliateService(affiliates, settingsRepo, managers);
  const affiliateLinkService = new AffiliateLinkService(links);
  const commissionService = new CommissionService(commissions, affiliates, settingsRepo, walletService, userReferrals, managers);

  return {
    walletService,
    wallets,
    affiliates,
    links,
    commissions,
    settingsRepo,
    userReferrals,
    managers,
    affiliateService,
    affiliateLinkService,
    commissionService,
  };
}
