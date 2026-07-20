import { EventEmitter } from "node:events";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "event-bus" });

/**
 * Envelope every published event carries — consistent shape regardless of
 * which module or subsystem (domain vs. infrastructure) raised it.
 */
export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  name: TName;
  payload: TPayload;
  occurredAt: Date;
  /** e.g. a userId or matchId — lets a listener correlate without parsing the payload. */
  correlationId?: string;
}

export type EventHandler<TPayload = unknown> = (
  event: DomainEvent<string, TPayload>
) => void | Promise<void>;

/**
 * Swappable event bus contract. `InProcessEventBus` (below) is the Phase 2
 * implementation — a thin EventEmitter wrapper, single-process only. If a
 * later phase needs cross-process delivery (multiple API instances,
 * workers reacting to events raised by the web process), implement this
 * same interface backed by Redis pub/sub or a broker; no publisher/
 * subscriber call site changes.
 */
export interface IEventBus {
  publish<TPayload>(name: string, payload: TPayload, correlationId?: string): void;
  subscribe<TPayload>(name: string, handler: EventHandler<TPayload>): () => void;
}

class InProcessEventBus implements IEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Domain/infra events are fire-and-forget by design (see publish's
    // catch) — but a handler that throws synchronously would otherwise
    // crash the publisher's call stack. Cap listeners generously since many
    // modules will subscribe to the same infra events (e.g. "audit.write").
    this.emitter.setMaxListeners(50);
  }

  publish<TPayload>(name: string, payload: TPayload, correlationId?: string): void {
    const event: DomainEvent<string, TPayload> = {
      name,
      payload,
      occurredAt: new Date(),
      correlationId,
    };
    logger.debug({ event: name, correlationId }, "event published");
    for (const handler of this.emitter.listeners(name) as EventHandler<TPayload>[]) {
      try {
        void Promise.resolve(handler(event)).catch((err) =>
          logger.error({ err, event: name }, "async event handler threw")
        );
      } catch (err) {
        logger.error({ err, event: name }, "event handler threw synchronously");
      }
    }
  }

  subscribe<TPayload>(name: string, handler: EventHandler<TPayload>): () => void {
    this.emitter.on(name, handler as (...args: unknown[]) => void);
    return () => this.emitter.off(name, handler as (...args: unknown[]) => void);
  }
}

export const eventBus: IEventBus = new InProcessEventBus();
