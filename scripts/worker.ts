// Entry point for the standalone BullMQ worker process (see
// docker-compose.yml's `worker` service / `npm run worker`). Kept outside
// src/server so it's an obvious "this is a process you run", not a module
// anything imports.
//
// Env loading must happen before any of our modules are imported — but
// static `import`s are hoisted above top-level code by the ES module spec,
// so `process.loadEnvFile()` would otherwise run after `@/server/config/env`
// already threw on missing vars. Dynamic `import()` inside `bootstrap()` is
// what makes the load-then-import order actually happen.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file (e.g. production — real env vars are injected directly).
}

async function bootstrap() {
  const { createWorker, createQueue, QUEUE_NAMES } = await import("@/server/queue");
  const { createChildLogger } = await import("@/server/logger");
  const { startPushNotificationsWorker, createDailySummaryQueue, startDailySummaryWorker } = await import(
    "@/modules/notifications/queue/notification-queue"
  );
  const { DailySummaryService } = await import("@/modules/notifications/services/daily-summary.service");

  const logger = createChildLogger({ module: "worker-entrypoint" });

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

  // Fase X — Push Notifications: NotificationDispatcher (web process) only
  // ever enqueues; this is what actually calls the Web Push provider.
  const pushWorker = startPushNotificationsWorker();

  // Daily summary — repeatable trigger at 23:59, the handler does the
  // aggregation + publishes DAILY_SUMMARY_EVENTS.generated (the web
  // process's dispatcher, subscribed via src/instrumentation.ts, turns that
  // into the admin broadcast push).
  const dailySummaryService = new DailySummaryService();
  const dailySummaryWorker = startDailySummaryWorker(() => dailySummaryService.buildAndPublish());
  const dailySummaryQueue = createDailySummaryQueue();
  await dailySummaryQueue.add("daily-summary", {}, { repeat: { pattern: "59 23 * * *" }, jobId: "daily-summary-repeat" });

  logger.info("worker process started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker shutting down");
    await worker.close();
    await heartbeatQueue.close();
    await pushWorker.close();
    await dailySummaryWorker.close();
    await dailySummaryQueue.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("worker failed to start", err);
  process.exit(1);
});
