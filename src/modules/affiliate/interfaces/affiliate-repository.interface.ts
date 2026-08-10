import type { AffiliateProfile, AffiliateProfileAdminRow, AffiliateStatus } from "@/modules/affiliate/entities/affiliate.entity";

export interface CreateAffiliateProfileInput {
  userId: string;
  managerId?: string | null;
  status?: AffiliateStatus;
  documentsJson?: Record<string, unknown> | null;
  pixKeyEncrypted?: string | null;
}

export interface UpdateAffiliateProfileInput {
  managerId?: string | null;
  status?: AffiliateStatus;
  documentsJson?: Record<string, unknown> | null;
  pixKeyEncrypted?: string | null;
  revShareOverridePercent?: number | null;
  approvedAt?: Date | null;
  approvedById?: string | null;
  rejectionReason?: string | null;
  blockedAt?: Date | null;
  blockedReason?: string | null;
  canInviteAffiliates?: boolean;
}

export interface AffiliateProfileListFilter {
  status?: AffiliateStatus;
  managerId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

/** Service layer depends on this interface only, never on `@/lib/prisma` directly — see repositories/ for the Prisma + in-memory implementations. */
export interface IAffiliateRepository {
  create(input: CreateAffiliateProfileInput): Promise<AffiliateProfile>;
  findById(id: string): Promise<AffiliateProfile | null>;
  findByUserId(userId: string): Promise<AffiliateProfile | null>;
  /** Same join as listAdmin's rows, for a single id — admin/manager detail drawers. */
  findByIdAdmin(id: string): Promise<AffiliateProfileAdminRow | null>;
  /** Same join as findByIdAdmin, keyed by userId — backs the "does this User already have an AffiliateProfile" lookup from the admin Users drawer (see AffiliateService.getByUserIdAdmin). */
  findByUserIdAdmin(userId: string): Promise<AffiliateProfileAdminRow | null>;
  update(id: string, input: UpdateAffiliateProfileInput): Promise<AffiliateProfile>;
  listAdmin(filter: AffiliateProfileListFilter): Promise<{ items: AffiliateProfileAdminRow[]; total: number }>;
  /** "Meu Link" (/r/{code}) hit-count, mirrors ManagerProfile.incrementPlatformLinkClicks — bumped by /r/[code]/route.ts for an APPROVED affiliate. */
  incrementLinkClicks(userId: string): Promise<void>;
}
