import { walletContainer } from "@/modules/wallet/container";
import type { IWalletLedger, WalletMoveResult } from "@/modules/match-engine/interfaces/wallet-ledger.interface";

const { walletService } = walletContainer;

const SYSTEM_ACTOR = { actorId: null, actorType: "SYSTEM" as const };

/** Delegates every balance movement to WalletService — the platform's sole writer of Wallet balances (see src/modules/wallet). */
export class PrismaWalletLedger implements IWalletLedger {
  async getBalance(userId: string): Promise<number> {
    const balances = await walletService.getBalance(userId);
    return balances.main;
  }

  async debitForBet(userId: string, amountCents: number, matchId: string): Promise<WalletMoveResult> {
    const result = await walletService.debit({
      userId,
      amountCents,
      type: "BET",
      origin: "match-engine",
      originId: matchId,
      idempotencyKey: `match:${matchId}:bet`,
      actor: SYSTEM_ACTOR,
    });
    return { balanceBefore: result.balanceBefore.main, balanceAfter: result.balanceAfter.main };
  }

  async creditForPayout(userId: string, amountCents: number, matchId: string): Promise<WalletMoveResult> {
    const result = await walletService.credit({
      userId,
      amountCents,
      type: "PAYOUT",
      origin: "match-engine",
      originId: matchId,
      idempotencyKey: `match:${matchId}:payout`,
      actor: SYSTEM_ACTOR,
    });
    return { balanceBefore: result.balanceBefore.main, balanceAfter: result.balanceAfter.main };
  }

  async refundBet(userId: string, amountCents: number, matchId: string, reason: string): Promise<WalletMoveResult> {
    const result = await walletService.refund({
      userId,
      amountCents,
      origin: "match-engine",
      originId: matchId,
      description: reason,
      idempotencyKey: `match:${matchId}:refund`,
      actor: SYSTEM_ACTOR,
    });
    return { balanceBefore: result.balanceBefore.main, balanceAfter: result.balanceAfter.main };
  }
}
