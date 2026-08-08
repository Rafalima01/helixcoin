import type { UserStatus } from "@prisma/client";

/**
 * A row of the "Contas Demo" listing — not a domain aggregate of its own.
 * The underlying record is a plain `User` with `isDemo: true`; this shape
 * exists purely for the admin listing screen, joining wallet balance and
 * the most recent session's activity timestamp.
 */
export interface DemoAccountRow {
  id: string;
  fullName: string;
  /** Internal identifier only — not the login credential, see `phone`. */
  login: string;
  /** The login identifier (phone+senha, same as any real player) — null only for accounts created before phone became mandatory here. */
  phone: string | null;
  status: UserStatus;
  balanceCents: number;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
}
