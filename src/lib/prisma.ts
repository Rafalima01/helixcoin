import { PrismaClient } from "@prisma/client";
import { createChildLogger } from "@/server/logger";
import { isDevelopment } from "@/server/config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const dbLogger = createChildLogger({ module: "database" });

function buildPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
      ...(isDevelopment ? [{ emit: "event" as const, level: "query" as const }] : []),
    ],
  });

  client.$on("error", (e) => dbLogger.error({ target: e.target }, e.message));
  client.$on("warn", (e) => dbLogger.warn({ target: e.target }, e.message));
  client.$on("query", (e) => dbLogger.debug({ durationMs: e.duration }, e.query));

  return client;
}

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
