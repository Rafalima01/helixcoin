/** Extension points, same "publish now, consumers subscribe independently" convention as WALLET_EVENTS/PAYMENT_EVENTS/AFFILIATE_EVENTS. */
export const COMMERCIAL_WITHDRAW_EVENTS = {
  requested: "commercial_withdraw.requested",
  approved: "commercial_withdraw.approved",
  rejected: "commercial_withdraw.rejected",
} as const;

export interface CommercialWithdrawEventPayload {
  id: string;
  userId: string;
  amountCents: number;
  payeeRole: string;
}
