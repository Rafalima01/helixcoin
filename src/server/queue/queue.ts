import { Queue, type JobsOptions } from "bullmq";
import { createQueueConnection } from "@/server/queue/connection";

/** Applied unless a call site overrides them per-job. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/** Known queue names — the registry every producer/worker pair should import from, not string-literal. */
export const QUEUE_NAMES = {
  /** Infra self-test: proves the Queue → Worker → Redis path is wired end to end. No business meaning. */
  systemHeartbeat: "system.heartbeat",
  /** Where jobs land after exhausting retries — see createWorker's `deadLetterQueue` option. */
  deadLetter: "system.dead-letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function createQueue<T = unknown>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: createQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}
