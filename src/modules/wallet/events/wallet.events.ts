/** Not consumed by anything yet — extension points for PIX/Analytics/Cashback/Affiliates/Missions/Notifications, out of scope this phase. */
export const WALLET_EVENTS = {
  credited: "wallet.credited",
  debited: "wallet.debited",
  locked: "wallet.locked",
  unlocked: "wallet.unlocked",
  adjusted: "wallet.adjusted",
  refunded: "wallet.refunded",
  transactionCreated: "wallet.transaction.created",
} as const;

export interface WalletEventPayload {
  transactionId: string;
  userId: string;
  type: string;
  account: string;
  amount: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  origin: string;
  originId: string | null;
}
