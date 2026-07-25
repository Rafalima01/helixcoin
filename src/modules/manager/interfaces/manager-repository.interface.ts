import type { ManagerProfile, ManagerProfileAdminRow, ManagerProfileStatus } from "@/modules/manager/entities/manager.entity";

export interface CreateManagerProfileInput {
  userId: string;
  inviteCode: string;
  commissionPercent: number;
  status: ManagerProfileStatus;
  inviteId?: string | null;
}

export interface UpdateManagerProfileInput {
  commissionPercent?: number;
  status?: ManagerProfileStatus;
}

export interface ManagerProfileListFilter {
  search?: string;
  page: number;
  pageSize: number;
}

export interface IManagerRepository {
  create(input: CreateManagerProfileInput): Promise<ManagerProfile>;
  findById(id: string): Promise<ManagerProfile | null>;
  findByUserId(userId: string): Promise<ManagerProfile | null>;
  findByInviteCode(inviteCode: string): Promise<ManagerProfile | null>;
  /** Same join as listAdmin's rows, for a single id — the admin detail drawer. */
  findByIdAdmin(id: string): Promise<ManagerProfileAdminRow | null>;
  listAdmin(filter: ManagerProfileListFilter): Promise<{ items: ManagerProfileAdminRow[]; total: number }>;
  update(id: string, data: UpdateManagerProfileInput): Promise<ManagerProfile>;
  incrementPlatformLinkClicks(userId: string): Promise<void>;
  incrementInviteLinkClicks(inviteCode: string): Promise<void>;
}
