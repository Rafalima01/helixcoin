import { walletContainer } from "@/modules/wallet/container";
import { AffiliateService } from "@/modules/affiliate/services/affiliate.service";
import { AffiliateLinkService } from "@/modules/affiliate/services/affiliate-link.service";
import { CommissionService } from "@/modules/affiliate/services/commission.service";
import { PrismaAffiliateRepository } from "@/modules/affiliate/repositories/affiliate.prisma-repository";
import { PrismaAffiliateLinkRepository } from "@/modules/affiliate/repositories/affiliate-link.prisma-repository";
import { PrismaCommissionRepository } from "@/modules/affiliate/repositories/commission.prisma-repository";
import { PrismaAffiliateSettingsRepository } from "@/modules/affiliate/repositories/affiliate-settings.prisma-repository";
import { PrismaUserReferralRepository } from "@/modules/affiliate/repositories/user-referral.prisma-repository";
// Own instance — NOT src/modules/manager/container.ts's, which imports this
// container and would create a cycle. See affiliate.service.ts's doc comment.
import { PrismaManagerRepository } from "@/modules/manager/repositories/manager.prisma-repository";

const affiliates = new PrismaAffiliateRepository();
const links = new PrismaAffiliateLinkRepository();
const commissions = new PrismaCommissionRepository();
const settings = new PrismaAffiliateSettingsRepository();
const userReferrals = new PrismaUserReferralRepository();
const managers = new PrismaManagerRepository();

const affiliateService = new AffiliateService(affiliates, settings, managers);
const affiliateLinkService = new AffiliateLinkService(links);
const commissionService = new CommissionService(commissions, affiliates, settings, walletContainer.walletService, userReferrals, managers);

// Wires the commission engine to the existing payments deposit-confirmed
// event exactly once, at module load — see commission.service.ts's doc
// comment. Never called again; there is only ever one live subscription.
commissionService.subscribeToDeposits();

export const affiliateContainer = {
  affiliateService,
  affiliateLinkService,
  commissionService,
  affiliateRepository: affiliates,
  commissionRepository: commissions,
};
