export interface MfaMethodRecord {
  id: string;
  userId: string;
  type: "TOTP" | "EMAIL" | "SMS";
  enabled: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
}

/** Structure-only repository — see mfa.service.ts's doc comment for why nothing here does real enrollment yet. */
export interface IMfaMethodRepository {
  listByUser(userId: string): Promise<MfaMethodRecord[]>;
  countRecoveryCodes(userId: string): Promise<number>;
}
