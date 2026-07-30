import { identityContainer } from "@/modules/identity/container";
import { walletContainer } from "@/modules/wallet/container";
import { PrismaUserSessionRepository } from "@/modules/identity/repositories/session.prisma-repository";
import { PrismaDemoAccountRepository } from "@/modules/demo-accounts/repositories/demo-account.prisma-repository";
import { DemoAccountService } from "@/modules/demo-accounts/services/demo-account.service";

const sessions = new PrismaUserSessionRepository();
const demoAccountRepository = new PrismaDemoAccountRepository();

export const demoAccountsContainer = {
  demoAccountService: new DemoAccountService(
    identityContainer.userRepository,
    sessions,
    walletContainer.walletService,
    demoAccountRepository
  ),
};
