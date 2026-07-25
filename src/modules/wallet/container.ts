import { PrismaWalletRepository } from "@/modules/wallet/repositories/wallet.prisma-repository";
import { WalletService } from "@/modules/wallet/services/wallet.service";

const wallets = new PrismaWalletRepository();

export const walletContainer = {
  walletService: new WalletService(wallets),
};
