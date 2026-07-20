import { describe, expect, it, vi } from "vitest";
import { eventBus } from "@/server/events/event-bus";

describe("eventBus", () => {
  it("delivers a published event to a subscribed handler", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe("test.event", handler);

    eventBus.publish("test.event", { foo: "bar" }, "corr-1");

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.name).toBe("test.event");
    expect(event.payload).toEqual({ foo: "bar" });
    expect(event.correlationId).toBe("corr-1");
    expect(event.occurredAt).toBeInstanceOf(Date);

    unsubscribe();
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe("test.unsub", handler);
    unsubscribe();

    eventBus.publish("test.unsub", {});

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not deliver to handlers subscribed to a different event name", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.subscribe("test.other", handler);

    eventBus.publish("test.unrelated", {});

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("a throwing handler does not prevent other handlers of the same event from running", () => {
    const good = vi.fn();
    const unsubBad = eventBus.subscribe("test.mixed", () => {
      throw new Error("boom");
    });
    const unsubGood = eventBus.subscribe("test.mixed", good);

    expect(() => eventBus.publish("test.mixed", {})).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);

    unsubBad();
    unsubGood();
  });
});
