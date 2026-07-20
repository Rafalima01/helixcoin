/** Shared shape for both PasswordResetToken and EmailVerificationToken repositories. */
export interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IPasswordResetTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date, requestIp: string | null): Promise<StoredToken>;
  findValidByHash(tokenHash: string): Promise<StoredToken | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}

export interface StoredEmailToken extends StoredToken {
  email: string;
}

export interface IEmailVerificationTokenRepository {
  create(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<StoredEmailToken>;
  findValidByHash(tokenHash: string): Promise<StoredEmailToken | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}
