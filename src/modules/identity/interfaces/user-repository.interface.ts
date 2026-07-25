import type { UserEntity } from "@/modules/identity/entities/user.entity";
import type { UserSearchQuery } from "@/modules/identity/dto/user.dto";

export interface CreateUserRecord {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  role?: UserEntity["role"];
  status?: UserEntity["status"];
  referralCode: string;
  referredById?: string | null;
  /** Phase 8 — analytics-only tag, see AffiliateLink's schema doc comment. Never used for attribution. */
  affiliateLinkId?: string | null;
}

export type UpdateUserRecord = Partial<
  Omit<UserEntity, "id" | "createdAt" | "updatedAt" | "passwordHash" | "referralCode">
>;

export interface UserSearchResult {
  items: UserEntity[];
  total: number;
}

/**
 * Repository Pattern: services depend on this interface, never on Prisma
 * directly (see src/modules/_template's README for why). Soft-deleted rows
 * (`deletedAt` set) are excluded by every method except `findById` (an
 * admin restoring a user needs to find it first) and `search` when
 * `includeDeleted` is set.
 */
export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByUsername(username: string): Promise<UserEntity | null>;
  findByReferralCode(referralCode: string): Promise<UserEntity | null>;
  create(data: CreateUserRecord): Promise<UserEntity>;
  update(id: string, data: UpdateUserRecord): Promise<UserEntity>;
  /** The only sanctioned write path for passwordHash — kept off UpdateUserRecord so a generic `update()` call can never touch it by accident. */
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  search(query: UserSearchQuery): Promise<UserSearchResult>;
  incrementLoginAttempts(id: string): Promise<number>;
  resetLoginAttempts(id: string): Promise<void>;
  setLockedUntil(id: string, until: Date | null): Promise<void>;
  recordLogin(id: string, at: Date): Promise<void>;
}
