import { describe, expect, it } from "vitest";
import { resolveDateRange, previousPeriod } from "@/lib/date-range";

// São Paulo has been a fixed UTC-3 offset since DST was abolished in 2019 —
// these fixtures rely on that being true for the dates used here.

describe("resolveDateRange", () => {
  it('"today" starts at 00:00 São Paulo, not 00:00 UTC', () => {
    // 2026-07-31T14:30:00Z = 2026-07-31T11:30:00-03:00 (São Paulo) — well
    // into the SP day, so both UTC and SP agree it's the 31st.
    const now = new Date("2026-07-31T14:30:00.000Z");
    const { start, end } = resolveDateRange("today", undefined, now);

    expect(start.toISOString()).toBe("2026-07-31T03:00:00.000Z"); // 00:00 SP == 03:00 UTC
    expect(end).toBe(now);
  });

  it('"today" resolves to the SP calendar day, even when UTC has already rolled to the next day', () => {
    // 2026-07-31T02:00:00Z = 2026-07-30T23:00:00-03:00 São Paulo — still the
    // 30th in SP even though it's already the 31st in UTC. This is the
    // exact case the old UTC-bucketing implementation got wrong.
    const now = new Date("2026-07-31T02:00:00.000Z");
    const { start } = resolveDateRange("today", undefined, now);

    expect(start.toISOString()).toBe("2026-07-30T03:00:00.000Z"); // 00:00 SP on the 30th
  });

  it('"yesterday" covers a full SP calendar day, ending exactly where "today" begins', () => {
    const now = new Date("2026-07-31T14:30:00.000Z");
    const { start, end } = resolveDateRange("yesterday", undefined, now);

    expect(start.toISOString()).toBe("2026-07-30T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-31T03:00:00.000Z");
  });

  it('"7d" starts 6 SP-days before today at 00:00', () => {
    const now = new Date("2026-07-31T14:30:00.000Z");
    const { start, end } = resolveDateRange("7d", undefined, now);

    expect(start.toISOString()).toBe("2026-07-25T03:00:00.000Z");
    expect(end).toBe(now);
  });

  it('"15d" starts 14 SP-days before today at 00:00', () => {
    const now = new Date("2026-07-31T14:30:00.000Z");
    const { start } = resolveDateRange("15d", undefined, now);

    expect(start.toISOString()).toBe("2026-07-17T03:00:00.000Z");
  });

  it('"month" starts on the 1st of the current SP month at 00:00', () => {
    const now = new Date("2026-07-31T14:30:00.000Z");
    const { start, end } = resolveDateRange("month", undefined, now);

    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(end).toBe(now);
  });

  it('"custom" treats dateFrom/dateTo as inclusive SP calendar days', () => {
    const { start, end } = resolveDateRange("custom", { dateFrom: "2026-07-01", dateTo: "2026-07-15" });

    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-16T03:00:00.000Z"); // exclusive upper bound = start of the 16th
  });

  it('"custom" throws without dateFrom/dateTo', () => {
    expect(() => resolveDateRange("custom")).toThrow();
  });
});

describe("previousPeriod", () => {
  it("returns the immediately-preceding period of equal duration", () => {
    const range = { start: new Date("2026-07-25T03:00:00.000Z"), end: new Date("2026-08-01T03:00:00.000Z") };
    const prev = previousPeriod(range);

    expect(prev.end).toEqual(range.start);
    expect(prev.start.toISOString()).toBe("2026-07-18T03:00:00.000Z");
  });
});
