import type { Role, UserStatus } from "@prisma/client";
import { fullName, type UserEntity } from "@/modules/identity/entities/user.entity";

/** Safe public shape — never includes passwordHash. What "me" and admin list/detail endpoints return. */
export interface UserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  cpf: string | null;
  dateOfBirth: string | null;
  locale: string;
  timezone: string;
  status: UserStatus;
  role: Role;
  tags: string[];
  lastLoginAt: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  locked: boolean;
  referralCode: string;
  xp: number;
  level: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function toUserResponseDto(user: UserEntity, now = new Date()): UserResponseDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: fullName(user),
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    cpf: user.cpf,
    dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
    locale: user.locale,
    timezone: user.timezone,
    status: user.status,
    role: user.role,
    tags: user.tags,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    emailVerified: !!user.emailVerifiedAt,
    phoneVerified: !!user.phoneVerifiedAt,
    mfaEnabled: user.mfaEnabled,
    locked: !!user.lockedUntil && user.lockedUntil > now,
    referralCode: user.referralCode,
    xp: user.xp,
    level: user.level,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
  role?: Role;
  status?: UserStatus;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  /** `null` explicitly clears the field; `undefined` leaves it unchanged. */
  phone?: string | null;
  avatar?: string | null;
  cpf?: string | null;
  dateOfBirth?: string | null;
  locale?: string;
  timezone?: string;
  role?: Role;
  status?: UserStatus;
  tags?: string[];
}

export interface UserSearchQuery {
  search?: string; // matches name/email/phone/cpf/id/username
  status?: UserStatus;
  role?: Role;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  mfaEnabled?: boolean;
  locked?: boolean;
  createdFrom?: string;
  createdTo?: string;
  includeDeleted?: boolean;
  page: number;
  pageSize: number;
  sort: "createdAt" | "lastLoginAt" | "firstName" | "email" | "status";
  order: "asc" | "desc";
}
