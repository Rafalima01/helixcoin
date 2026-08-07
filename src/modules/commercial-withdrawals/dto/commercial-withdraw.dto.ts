import { maskPixKey } from "@/modules/payments/constants/payments.constants";
import type { PixKey } from "@/modules/commercial-withdrawals/entities/pix-key.entity";
import type { CommercialWithdraw, CommercialWithdrawAdminRow } from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";

// ---------------------------------------------------------------------------
// Player-facing (both Affiliate and Manager routes)
// ---------------------------------------------------------------------------

/** GET/POST /api/{affiliate|manager}/pix-keys — the raw `keyEncrypted` never leaves the server, only a masked display value. */
export interface PixKeyDto {
  id: string;
  type: string;
  keyMasked: string;
  holderCpf: string;
  createdAt: string;
  updatedAt: string;
}

export function toPixKeyDto(entity: PixKey, decryptedKey: string): PixKeyDto {
  return {
    id: entity.id,
    type: entity.type,
    keyMasked: maskPixKey(decryptedKey),
    holderCpf: entity.holderCpf,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/** GET/POST /api/{affiliate|manager}/withdrawals — status is always PENDING right after a POST, never an assumed-final balance (same convention as payments' WithdrawRequestResultDto). */
export interface CommercialWithdrawDto {
  id: string;
  payeeRole: string;
  amountCents: number;
  status: string;
  pixKeyMasked: string;
  pixKeyType: string;
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export function toCommercialWithdrawDto(entity: CommercialWithdraw, decryptedPixKey: string): CommercialWithdrawDto {
  return {
    id: entity.id,
    payeeRole: entity.payeeRole,
    amountCents: entity.amountCents,
    status: entity.status,
    pixKeyMasked: maskPixKey(decryptedPixKey),
    pixKeyType: entity.pixKeyType,
    rejectionReason: entity.rejectionReason,
    requestedAt: entity.requestedAt.toISOString(),
    processedAt: entity.processedAt ? entity.processedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** `pixKeyMasked` is always precomputed by the caller (CommercialWithdrawService) — the DTO layer never decrypts a PIX key itself, same convention as payments' toWithdrawAdminDto. */
export interface CommercialWithdrawAdminDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  payeeRole: string;
  amountCents: number;
  status: string;
  pixKeyMasked: string;
  pixKeyType: string;
  holderCpf: string;
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
}

export function toCommercialWithdrawAdminDto(row: CommercialWithdrawAdminRow, pixKeyMasked: string): CommercialWithdrawAdminDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    payeeRole: row.payeeRole,
    amountCents: row.amountCents,
    status: row.status,
    pixKeyMasked,
    pixKeyType: row.pixKeyType,
    holderCpf: row.holderCpf,
    rejectionReason: row.rejectionReason,
    requestedAt: row.requestedAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
