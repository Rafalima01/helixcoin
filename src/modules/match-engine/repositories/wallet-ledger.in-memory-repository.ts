import { BusinessRuleError } from "@/server/errors";
import type { IWalletLedger, WalletMoveResult } from "@/modules/match-engine/interfaces/wallet-ledger.interface";

/** In-memory implementation for tests — seed balances via `.setBalance(userId, cents)`. */
export class InMemoryWalletLedger implements IWalletLedger {
  private readonly balances = new Map<string, number>();

  setBalance(userId: string, cents: number): void {
    this.balances.set(userId, cents);
  }

  async getBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 0;
  }

  async debitForBet(userId: string, amountCents: number): Promise<WalletMoveResult> {
    const balanceBefore = this.balances.get(userId) ?? 0;
    if (balanceBefore < amountCents) throw new BusinessRuleError("Saldo insuficiente");
    const balanceAfter = balanceBefore - amountCents;
    this.balances.set(userId, balanceAfter);
    return { balanceBefore, balanceAfter };
  }

  async creditForPayout(userId: string, amountCents: number): Promise<WalletMoveResult> {
    const balanceBefore = this.balances.get(userId) ?? 0;
    const balanceAfter = balanceBefore + amountCents;
    this.balances.set(userId, balanceAfter);
    return { balanceBefore, balanceAfter };
  }

  async refundBet(userId: string, amountCents: number): Promise<WalletMoveResult> {
    const balanceBefore = this.balances.get(userId) ?? 0;
    const balanceAfter = balanceBefore + amountCents;
    this.balances.set(userId, balanceAfter);
    return { balanceBefore, balanceAfter };
  }
}
