import type { IMfaMethodRepository, MfaMethodRecord } from "@/modules/identity/interfaces/mfa-repository.interface";

export class InMemoryMfaMethodRepository implements IMfaMethodRepository {
  private readonly methods = new Map<string, MfaMethodRecord[]>();

  async listByUser(userId: string): Promise<MfaMethodRecord[]> {
    return this.methods.get(userId) ?? [];
  }

  async countRecoveryCodes(): Promise<number> {
    return 0;
  }
}
