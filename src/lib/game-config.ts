import { prisma } from "@/lib/prisma";

/** Fetch the singleton platform config, creating it with defaults if absent. */
export function getGameConfig() {
  return prisma.gameConfig.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
}

export function setMaintenanceMode(enabled: boolean) {
  return prisma.gameConfig.upsert({
    where: { id: "global" },
    update: { maintenanceMode: enabled },
    create: { id: "global", maintenanceMode: enabled },
  });
}
