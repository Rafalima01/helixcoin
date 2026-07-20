// Entry point for the standalone BullMQ worker process (see
// docker-compose.yml's `worker` service / `npm run worker`). Kept outside
// src/server so it's an obvious "this is a process you run", not a module
// anything imports.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file (e.g. production — real env vars are injected directly).
}

import { createWorker, createQueue, QUEUE_NAMES } from "@/server/queue";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "worker-entrypoint" });

async function main() {
  // Infra self-test job — proves Queue → Redis → Worker → retry/DLQ wiring
  // works end to end. No business meaning; the first real module adds its
  // own queue + worker alongside this, it doesn't replace it.
  const worker = createWorker<{ startedAt: string }>(
    QUEUE_NAMES.systemHeartbeat,
    async (job) => {
      logger.info({ jobId: job.id, startedAt: job.data.startedAt }, "heartbeat tick");
    },
    { concurrency: 1, deadLetterQueue: QUEUE_NAMES.deadLetter }
  );

  const heartbeatQueue = createQueue<{ startedAt: string }>(QUEUE_NAMES.systemHeartbeat);
  await heartbeatQueue.add(
    "heartbeat",
    { startedAt: new Date().toISOString() },
    { repeat: { every: 30_000 }, jobId: "heartbeat-repeat" }
  );

  logger.info("worker process started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutting down");
    await worker.close();
    await heartbeatQueue.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});
