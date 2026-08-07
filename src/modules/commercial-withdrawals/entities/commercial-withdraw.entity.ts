import type { CommercialWithdrawPayeeRole, CommercialWithdrawStatus } from "@prisma/client";
import type { PixKeyType } from "@/modules/commercial-withdrawals/entities/pix-key.entity";

export type { CommercialWithdrawPayeeRole, CommercialWithdrawStatus };

/** Domain entity — one commercial withdrawal request (Affiliate/Manager cashing out their commission balance). Always admin-approved, never automatic — see CommercialWithdrawService.decide's CAS-based transition. */
export interface CommercialWithdraw {
  id: string;
  userId: string;
  payeeRole: CommercialWithdrawPayeeRole;
  amountCents: number;
  status: CommercialWithdrawStatus;
  /** Null if the source PixKey was later deleted — pixKeyEncrypted/holderCpf below are a permanent snapshot regardless. */
  pixKeyId: string | null;
  pixKeyType: PixKeyType;
  pixKeyEncrypted: string;
  holderCpf: string;
  lockWalletTransactionId: string | null;
  settleWalletTransactionId: string | null;
  rejectionReason: string | null;
  decidedByUserId: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin list/detail row — CommercialWithdraw joined with the owning user's
 * display fields. `pixKeyMasked` is deliberately NOT here — same convention
 * as payments' WithdrawAdminRow: the service layer decrypts+masks
 * (CommercialWithdrawService.listAdmin/getAdmin), the repository never
 * touches crypto-utils.
 */
export interface CommercialWithdrawAdminRow extends CommercialWithdraw {
  userName: string;
  userEmail: string;
}
