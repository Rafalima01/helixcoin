import type { UserEntity } from "@/modules/identity/entities/user.entity";
import type {
  CreateUserRecord,
  IUserRepository,
  UpdateUserRecord,
  UserSearchResult,
} from "@/modules/identity/interfaces/user-repository.interface";
import type { UserSearchQuery } from "@/modules/identity/dto/user.dto";

export class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, UserEntity>();

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return [...this.users.values()].find((u) => u.email === email && !u.deletedAt) ?? null;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return [...this.users.values()].find((u) => u.username === username && !u.deletedAt) ?? null;
  }

  async findByReferralCode(referralCode: string): Promise<UserEntity | null> {
    return (
      [...this.users.values()].find((u) => u.referralCode === referralCode && !u.deletedAt) ?? null
    );
  }

  async create(data: CreateUserRecord): Promise<UserEntity> {
    const now = new Date();
    const user: UserEntity = {
      id: crypto.randomUUID(),
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      email: data.email,
      phone: data.phone ?? null,
      passwordHash: data.passwordHash,
      avatar: null,
      cpf: null,
      dateOfBirth: null,
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      status: data.status ?? "PENDING",
      role: data.role ?? "USER",
      tags: data.tags ?? [],
      lastLoginAt: null,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      mfaEnabled: false,
      loginAttempts: 0,
      lockedUntil: null,
      suspendedUntil: null,
      referralCode: data.referralCode,
      referredById: data.referredById ?? null,
      signupSource: data.signupSource ?? null,
      eligibleForFirstDepositBonus: data.eligibleForFirstDepositBonus ?? false,
      isDemo: data.isDemo ?? false,
      xp: 0,
      level: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, data: UpdateUserRecord): Promise<UserEntity> {
    const existing = this.users.get(id);
    if (!existing) throw new Error(`User ${id} not found`);
    const updated: UserEntity = { ...existing, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, passwordHash, updatedAt: new Date() });
  }

  async softDelete(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, deletedAt: new Date() });
  }

  async restore(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, deletedAt: null });
  }

  async search(query: UserSearchQuery): Promise<UserSearchResult> {
    let items = [...this.users.values()].filter((u) => query.includeDeleted || !u.deletedAt);

    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(
        (u) =>
          u.firstName.toLowerCase().includes(term) ||
          u.lastName.toLowerCase().includes(term) ||
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.id === query.search
      );
    }
    if (query.status) items = items.filter((u) => u.status === query.status);
    if (query.role) items = items.filter((u) => u.role === query.role);

    const total = items.length;
    const start = (query.page - 1) * query.pageSize;
    items = items
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
      .slice(start, start + query.pageSize);

    return { items, total };
  }

  async incrementLoginAttempts(id: string): Promise<number> {
    const user = this.users.get(id);
    if (!user) return 0;
    const attempts = user.loginAttempts + 1;
    this.users.set(id, { ...user, loginAttempts: attempts });
    return attempts;
  }

  async resetLoginAttempts(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, loginAttempts: 0, lockedUntil: null });
  }

  async setLockedUntil(id: string, until: Date | null): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, lockedUntil: until });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, lastLoginAt: at });
  }
}
