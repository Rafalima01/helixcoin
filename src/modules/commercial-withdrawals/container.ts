import { walletContainer } from "@/modules/wallet/container";
import { identityContainer } from "@/modules/identity/container";
import { PixKeyService } from "@/modules/commercial-withdrawals/services/pix-key.service";
import { CommercialWithdrawService } from "@/modules/commercial-withdrawals/services/commercial-withdraw.service";
import { PrismaPixKeyRepository } from "@/modules/commercial-withdrawals/repositories/pix-key.prisma-repository";
import { PrismaCommercialWithdrawRepository } from "@/modules/commercial-withdrawals/repositories/commercial-withdraw.prisma-repository";

const pixKeys = new PrismaPixKeyRepository();
const commercialWithdraws = new PrismaCommercialWithdrawRepository();

export const commercialWithdrawalsContainer = {
  pixKeyService: new PixKeyService(pixKeys, commercialWithdraws, identityContainer.userRepository),
  commercialWithdrawService: new CommercialWithdrawService(commercialWithdraws, pixKeys, walletContainer.walletService),
  pixKeyRepository: pixKeys,
  commercialWithdrawRepository: commercialWithdraws,
};
