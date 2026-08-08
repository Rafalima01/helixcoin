import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";

export interface DemoAccountListItemDto {
  id: string;
  fullName: string;
  /** Internal identifier only — not the login credential, see `phone`. */
  login: string;
  /** The login identifier (phone+senha, same as any real player). Null only for accounts created before phone became mandatory here — those can't authenticate until an admin sets one. */
  phone: string | null;
  status: string;
  balanceCents: number;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
}

export function toDemoAccountListItemDto(row: DemoAccountRow): DemoAccountListItemDto {
  return {
    id: row.id,
    fullName: row.fullName,
    login: row.login,
    phone: row.phone,
    status: row.status,
    balanceCents: row.balanceCents,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    lastActivityAt: row.lastActivityAt ? row.lastActivityAt.toISOString() : null,
  };
}

/** Only place the plaintext password is ever exposed — the create response, once, right after generation. Never persisted or logged in plaintext anywhere else. */
export interface DemoAccountCreatedDto {
  id: string;
  login: string;
  /** The login identifier — see DemoAccountRow.phone. Digits only; format client-side with @/lib/phone's formatPhone. */
  phone: string;
  password: string;
  balanceCents: number;
}
