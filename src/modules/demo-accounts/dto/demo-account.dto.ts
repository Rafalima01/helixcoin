import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";

export interface DemoAccountListItemDto {
  id: string;
  login: string;
  status: string;
  balanceCents: number;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
}

export function toDemoAccountListItemDto(row: DemoAccountRow): DemoAccountListItemDto {
  return {
    id: row.id,
    login: row.login,
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
  password: string;
  balanceCents: number;
}
