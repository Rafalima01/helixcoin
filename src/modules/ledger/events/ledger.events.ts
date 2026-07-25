/** Published by WalletService (never by LedgerService — it has no write path) whenever a LedgerEntry is created. */
export const LEDGER_EVENTS = {
  created: "ledger.created",
} as const;

export interface LedgerCreatedPayload {
  ledgerEntryId: string;
  transactionId: string;
}
