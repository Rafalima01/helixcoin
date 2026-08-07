import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { PixKeyService } from "@/modules/commercial-withdrawals/services/pix-key.service";
import { CommercialWithdrawService } from "@/modules/commercial-withdrawals/services/commercial-withdraw.service";
import { InMemoryPixKeyRepository } from "@/modules/commercial-withdrawals/repositories/pix-key.in-memory-repository";
import { InMemoryCommercialWithdrawRepository } from "@/modules/commercial-withdrawals/repositories/commercial-withdraw.in-memory-repository";

/** Fully-wired CommercialWithdrawService/PixKeyService over in-memory repositories — mirrors src/modules/payments/tests/test-helpers.ts's buildPaymentTestHarness pattern. */
export async function buildCommercialWithdrawTestHarness() {
  const wallets = new InMemoryWalletRepository();
  const walletService = new WalletService(wallets);

  const pixKeys = new InMemoryPixKeyRepository();
  const commercialWithdraws = new InMemoryCommercialWithdrawRepository();
  const users = new InMemoryUserRepository();

  const pixKeyService = new PixKeyService(pixKeys, commercialWithdraws, users);
  const commercialWithdrawService = new CommercialWithdrawService(commercialWithdraws, pixKeys, walletService);

  return { walletService, wallets, pixKeys, commercialWithdraws, users, pixKeyService, commercialWithdrawService };
}

/** Convenience — creates a user with a known cpf (for PixKeyService's CPF-match validation) and credits their MAIN wallet balance. Returns the generated userId (InMemoryUserRepository always mints its own uuid). */
export async function seedUserWithBalance(
  h: Awaited<ReturnType<typeof buildCommercialWithdrawTestHarness>>,
  opts: { cpf?: string; amountCents?: number } = {}
): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const user = await h.users.create({
    firstName: "Test",
    lastName: "User",
    username: `user_${suffix}`,
    email: `${suffix}@example.com`,
    passwordHash: "hash",
    referralCode: `REF${suffix}`,
    cpf: opts.cpf ?? null,
    role: "AFFILIATE",
    status: "ACTIVE",
  });

  if (opts.amountCents) {
    await h.walletService.credit({
      userId: user.id,
      amountCents: opts.amountCents,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: `setup-credit-${user.id}`,
      actor: { actorId: null, actorType: "SYSTEM" },
    });
  }

  return user.id;
}
