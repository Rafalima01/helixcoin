import { affiliateContainer } from "@/modules/affiliate/container";
import { ManagerService } from "@/modules/manager/services/manager.service";
import { ManagerInviteService } from "@/modules/manager/services/manager-invite.service";
import { PrismaManagerRepository } from "@/modules/manager/repositories/manager.prisma-repository";
import { PrismaManagerInviteRepository } from "@/modules/manager/repositories/manager-invite.prisma-repository";

const managers = new PrismaManagerRepository();
const managerInvites = new PrismaManagerInviteRepository();

export const managerContainer = {
  managerService: new ManagerService(managers, affiliateContainer.affiliateService, affiliateContainer.commissionRepository),
  managerInviteService: new ManagerInviteService(managerInvites, managers),
  managerRepository: managers,
  managerInviteRepository: managerInvites,
};
