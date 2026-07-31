/**
 * Timezone-aware date-range resolution for admin reporting (Dashboard period
 * filter). No date library is a dependency of this project — everything
 * here is built on the platform's own `Intl.DateTimeFormat`, which handles
 * DST/offset changes correctly without needing to hardcode an offset.
 */

export const APP_TIMEZONE = "America/Sao_Paulo";

export type DateRangePreset = "today" | "yesterday" | "7d" | "15d" | "month" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

/** How far `timeZone`'s wall-clock reading of `date` is ahead of UTC, in ms. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

/** The real UTC instant for `timeZone`'s local midnight on the given Y/M/D. */
function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

/** The Y/M/D `date` falls on when read in `timeZone`'s local calendar. */
function zonedYMD(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function addDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  // UTC-based arithmetic on a plain calendar date — no timezone involved yet,
  // the result is only ever fed back into zonedMidnight().
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Parses a "YYYY-MM-DD" string — throws on anything else (caller should validate with zod first). */
function parseYMD(value: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid date "${value}" — expected YYYY-MM-DD`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export interface CustomDateRangeInput {
  dateFrom: string;
  dateTo: string;
}

/**
 * Resolves an admin-facing period preset into real UTC instants, using
 * `APP_TIMEZONE` calendar-day boundaries — "Hoje" is 00:00 (São Paulo) until
 * now, "Ontem" is a full São Paulo calendar day, etc. `now` is injectable
 * for tests; defaults to the real current time.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  custom?: CustomDateRangeInput,
  now: Date = new Date()
): DateRange {
  const today = zonedYMD(now, APP_TIMEZONE);

  switch (preset) {
    case "today": {
      const start = zonedMidnight(today.year, today.month, today.day, APP_TIMEZONE);
      return { start, end: now };
    }
    case "yesterday": {
      const y = addDays(today.year, today.month, today.day, -1);
      const start = zonedMidnight(y.year, y.month, y.day, APP_TIMEZONE);
      const end = zonedMidnight(today.year, today.month, today.day, APP_TIMEZONE);
      return { start, end };
    }
    case "7d": {
      const from = addDays(today.year, today.month, today.day, -6);
      const start = zonedMidnight(from.year, from.month, from.day, APP_TIMEZONE);
      return { start, end: now };
    }
    case "15d": {
      const from = addDays(today.year, today.month, today.day, -14);
      const start = zonedMidnight(from.year, from.month, from.day, APP_TIMEZONE);
      return { start, end: now };
    }
    case "month": {
      const start = zonedMidnight(today.year, today.month, 1, APP_TIMEZONE);
      return { start, end: now };
    }
    case "custom": {
      if (!custom) throw new Error('resolveDateRange("custom") requires dateFrom/dateTo');
      const from = parseYMD(custom.dateFrom);
      const to = parseYMD(custom.dateTo);
      const start = zonedMidnight(from.year, from.month, from.day, APP_TIMEZONE);
      const toNext = addDays(to.year, to.month, to.day, 1);
      const end = zonedMidnight(toNext.year, toNext.month, toNext.day, APP_TIMEZONE);
      return { start, end };
    }
  }
}

/** The immediately-preceding period of equal duration — used for trend deltas. */
export function previousPeriod(range: DateRange): DateRange {
  const durationMs = range.end.getTime() - range.start.getTime();
  return { start: new Date(range.start.getTime() - durationMs), end: range.start };
}
