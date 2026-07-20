import { Worker, type Processor } from "bullmq";
import { createQueueConnection } from "@/server/queue/connection";
import { createQueue } from "@/server/queue/queue";
import { createChildLogger } from "@/server/logger";

export interface CreateWorkerOptions {
  concurrency?: number;
  /** Queue name to push a job into once it exhausts its retry attempts. */
  deadLetterQueue?: string;
}

/**
 * Wraps BullMQ's Worker with the two things every worker in this codebase
 * should have: structured logging on completion/failure, and — if
 * configured — a dead-letter hand-off instead of a job silently vanishing
 * after its final retry.
 */
export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  options: CreateWorkerOptions = {}
): Worker<T> {
  const logger = createChildLogger({ module: `queue.worker.${name}` });

  const worker = new Worker<T>(name, processor, {
    connection: createQueueConnection(),
    concurrency: options.concurrency ?? 5,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "job completed");
  });

  worker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, attemptsMade: job?.attemptsMade, err }, "job failed");

    const exhausted = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    if (options.deadLetterQueue && exhausted) {
      const dlq = createQueue(options.deadLetterQueue);
      try {
        await dlq.add(`dead:${job.name}`, {
          originalQueue: name,
          originalJobName: job.name,
          data: job.data,
          failedReason: err.message,
          failedAt: new Date().toISOString(),
        });
      } finally {
        await dlq.close();
      }
    }
  });

  return worker;
}
