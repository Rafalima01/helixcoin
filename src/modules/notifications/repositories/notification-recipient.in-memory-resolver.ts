import type { INotificationRecipientResolver } from "@/modules/notifications/interfaces/notification-recipient-resolver.interface";

/** Test double — every lookup is a plain in-memory map the test seeds directly, no chain-walking. */
export class InMemoryNotificationRecipientResolver implements INotificationRecipientResolver {
  constructor(
    private adminUserIds: string[] = [],
    private readonly managerByUserId: Map<string, string> = new Map(),
    private readonly managerByManagerId: Map<string, string> = new Map(),
    private readonly namesByUserId: Map<string, string> = new Map()
  ) {}

  setAdminUserIds(ids: string[]): void {
    this.adminUserIds = ids;
  }

  setManagerForUser(userId: string, managerUserId: string): void {
    this.managerByUserId.set(userId, managerUserId);
  }

  setManagerForManagerId(managerId: string, managerUserId: string): void {
    this.managerByManagerId.set(managerId, managerUserId);
  }

  setDisplayName(userId: string, name: string): void {
    this.namesByUserId.set(userId, name);
  }

  async listAdminUserIds(): Promise<string[]> {
    return this.adminUserIds;
  }

  async resolveManagerUserIdForUser(userId: string): Promise<string | null> {
    return this.managerByUserId.get(userId) ?? null;
  }

  async resolveManagerUserIdByManagerId(managerId: string): Promise<string | null> {
    return this.managerByManagerId.get(managerId) ?? null;
  }

  async getUserDisplayName(userId: string): Promise<string> {
    return this.namesByUserId.get(userId) ?? "Jogador";
  }
}
