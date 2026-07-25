/**
 * The commission engine's ONLY read of the identity module's User table —
 * kept as its own minimal interface (instead of a direct `@/lib/prisma`
 * call) so commission.service.ts's tree-walk stays testable against an
 * in-memory double, same "service depends on an interface, never Prisma
 * directly" convention as every other module.
 */
export interface IUserReferralRepository {
  /** Null when the user has no referrer (top of the chain). */
  findReferredById(userId: string): Promise<string | null>;
}
