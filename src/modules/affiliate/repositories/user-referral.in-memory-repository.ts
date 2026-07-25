import type { IUserReferralRepository } from "@/modules/affiliate/interfaces/user-referral-repository.interface";

/** Test double — seed the parent chain directly via `setReferrer`. */
export class InMemoryUserReferralRepository implements IUserReferralRepository {
  private readonly referredBy = new Map<string, string | null>();

  setReferrer(userId: string, referredById: string | null): void {
    this.referredBy.set(userId, referredById);
  }

  async findReferredById(userId: string): Promise<string | null> {
    return this.referredBy.get(userId) ?? null;
  }
}
