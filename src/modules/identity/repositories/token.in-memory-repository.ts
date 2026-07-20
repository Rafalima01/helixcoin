import type {
  IEmailVerificationTokenRepository,
  IPasswordResetTokenRepository,
  StoredEmailToken,
  StoredToken,
} from "@/modules/identity/interfaces/token-repository.interface";

export class InMemoryPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  private readonly tokens = new Map<string, StoredToken>();

  async create(userId: string, tokenHash: string, expiresAt: Date, requestIp: string | null): Promise<StoredToken> {
    const token: StoredToken = { id: crypto.randomUUID(), userId, tokenHash, expiresAt, usedAt: null, createdAt: new Date() };
    this.tokens.set(token.id, token);
    void requestIp; // stored on the Prisma implementation's column; not needed for in-memory test assertions
    return token;
  }

  async findValidByHash(tokenHash: string): Promise<StoredToken | null> {
    const now = new Date();
    return (
      [...this.tokens.values()].find(
        (t) => t.tokenHash === tokenHash && !t.usedAt && t.expiresAt > now
      ) ?? null
    );
  }

  async markUsed(id: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token) this.tokens.set(id, { ...token, usedAt: new Date() });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.usedAt) {
        this.tokens.set(token.id, { ...token, usedAt: new Date() });
      }
    }
  }
}

export class InMemoryEmailVerificationTokenRepository implements IEmailVerificationTokenRepository {
  private readonly tokens = new Map<string, StoredEmailToken>();

  async create(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<StoredEmailToken> {
    const token: StoredEmailToken = {
      id: crypto.randomUUID(),
      userId,
      email,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.tokens.set(token.id, token);
    return token;
  }

  async findValidByHash(tokenHash: string): Promise<StoredEmailToken | null> {
    const now = new Date();
    return (
      [...this.tokens.values()].find(
        (t) => t.tokenHash === tokenHash && !t.usedAt && t.expiresAt > now
      ) ?? null
    );
  }

  async markUsed(id: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token) this.tokens.set(id, { ...token, usedAt: new Date() });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId && !token.usedAt) {
        this.tokens.set(token.id, { ...token, usedAt: new Date() });
      }
    }
  }
}
