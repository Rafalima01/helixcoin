import type { Role, UserStatus } from "@prisma/client";

/**
 * Domain User — the full row, including `passwordHash`. Services operate on
 * this; DTOs (dto/user.dto.ts) strip `passwordHash` before anything crosses
 * an HTTP boundary. Never serialize this type directly in a response.
 */
export interface UserEntity {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  avatar: string | null;
  cpf: string | null;
  dateOfBirth: Date | null;
  locale: string;
  timezone: string;
  status: UserStatus;
  role: Role;
  tags: string[];
  lastLoginAt: Date | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  mfaEnabled: boolean;
  loginAttempts: number;
  lockedUntil: Date | null;
  suspendedUntil: Date | null;
  referralCode: string;
  referredById: string | null;
  xp: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function fullName(user: Pick<UserEntity, "firstName" | "lastName">): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function isLocked(user: Pick<UserEntity, "lockedUntil">, now = new Date()): boolean {
  return !!user.lockedUntil && user.lockedUntil > now;
}

export function isSuspended(user: Pick<UserEntity, "status" | "suspendedUntil">, now = new Date()): boolean {
  return user.status === "SUSPENDED" && (!user.suspendedUntil || user.suspendedUntil > now);
}

/** Whether this user is allowed to authenticate at all right now. */
export function canAuthenticate(user: UserEntity, now = new Date()): boolean {
  if (user.deletedAt) return false;
  if (user.status === "BLOCKED") return false;
  if (isSuspended(user, now)) return false;
  if (isLocked(user, now)) return false;
  return true;
}
