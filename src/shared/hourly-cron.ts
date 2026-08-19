/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

const MONTH_ALIASES: Readonly<Record<string, number>> = {
  APR: 4, AUG: 8, DEC: 12, FEB: 2, JAN: 1, JUL: 7,
  JUN: 6, MAR: 3, MAY: 5, NOV: 11, OCT: 10, SEP: 9,
};

const WEEKDAY_ALIASES: Readonly<Record<string, number>> = {
  FRI: 5, MON: 1, SAT: 6, SUN: 0, THU: 4, TUE: 2, WED: 3,
};

const DESCRIPTOR_CRON: Readonly<Record<string, string>> = {
  "@annually": "0 0 1 1 *",
  "@daily": "0 0 * * *",
  "@hourly": "0 * * * *",
  "@midnight": "0 0 * * *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@yearly": "0 0 1 1 *",
};

const DURATION_UNIT_NS: Readonly<Record<string, bigint>> = {
  h: 3_600_000_000_000n,
  m: 60_000_000_000n,
  ms: 1_000_000n,
  ns: 1n,
  s: 1_000_000_000n,
  us: 1_000n,
  µs: 1_000n,
  μs: 1_000n,
};

const GO_MAX_INT = 9_223_372_036_854_775_807n;
const ONE_SECOND_NS = 1_000_000_000n;
const ONE_HOUR_NS = 3_600n * ONE_SECOND_NS;

type ParsedCronSpec = {
  expression: string;
  timeZone?: string;
};

function parseCronSpec(value: string): ParsedCronSpec | null {
  const normalized = value.trim();
  const match = /^(?:TZ|CRON_TZ)=([^\s]+)\s+(.+)$/.exec(normalized);
  if (!match) return { expression: normalized };
  const [, timeZone = "", expression = ""] = match;
  if (timeZone !== "Local") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    } catch {
      return null;
    }
  }
  return { expression, ...(timeZone === "Local" ? {} : { timeZone }) };
}

function parseEveryDuration(value: string): number | null {
  const prefix = "@every ";
  if (!value.startsWith(prefix)) return null;
  const rawDuration = value.slice(prefix.length);
  const duration = rawDuration.startsWith("+") ? rawDuration.slice(1) : rawDuration;
  const tokenPattern = /(\d+(?:\.\d*)?|\.\d+)(ns|us|µs|μs|ms|s|m|h)/g;
  let consumed = 0;
  let total = 0n;
  for (const match of duration.matchAll(tokenPattern)) {
    if (match.index !== consumed) return null;
    const [, amount = "", unit = ""] = match;
    const unitNs = DURATION_UNIT_NS[unit];
    if (unitNs === undefined) return null;
    const [whole = "0", fraction = ""] = amount.split(".");
    const wholeNs = BigInt(whole || "0") * unitNs;
    const fractionNs = fraction
      ? BigInt(fraction) * unitNs / (10n ** BigInt(fraction.length))
      : 0n;
    total += wholeNs + fractionNs;
    if (total > GO_MAX_INT) return null;
    consumed += match[0].length;
  }
  if (consumed !== duration.length) return null;
  const truncated = total / ONE_SECOND_NS * ONE_SECOND_NS;
  return truncated >= ONE_HOUR_NS
    ? Number(truncated / ONE_SECOND_NS) * 1_000
    : null;
}

function parseCronInteger(value: string): number | null {
  if (!/^\+?\d+$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed > GO_MAX_INT) return null;
  return Number(parsed);
}

function parseCronField(
  value: string,
  min: number,
  max: number,
  aliases?: Readonly<Record<string, number>>,
): Set<number> | null {
  const values = new Set<number>();
  for (const part of value.split(",")) {
    const stepParts = part.split("/");
    if (stepParts.length > 2) return null;
    const [range = "", stepText] = stepParts;
    const step = stepText === undefined ? 1 : parseCronInteger(stepText);
    if (!range || step === null || step <= 0) return null;
    const rangeParts = range.split("-");
    if (rangeParts.length > 2) return null;
    const [startText, explicitEndText] =
      range === "*" || range === "?"
        ? [String(min), String(max)]
        : rangeParts;
    if (!startText || explicitEndText === "") return null;
    const start = aliases?.[startText.toUpperCase()] ?? parseCronInteger(startText);
    const endText =
      explicitEndText ?? (stepText === undefined ? startText : String(max));
    const end = aliases?.[endText.toUpperCase()] ?? parseCronInteger(endText);
    if (
      start === null || end === null ||
      start < min || end > max || start > end
    ) return null;
    for (let item = start; item <= end; item += step) values.add(item);
  }
  return values;
}

function isWildcardField(value: string): boolean {
  return value.split(",").some((part) => {
    const [range = "", stepText] = part.split("/");
    const step = stepText === undefined ? 1 : parseCronInteger(stepText);
    const keepsWildcardFlag = step !== null && step <= 1;
    return (range === "*" || range === "?") && keepsWildcardFlag;
  });
}

export type HourlyCronFields = {
  days: Set<number>;
  dayWildcard: boolean;
  hours: Set<number>;
  minutes: Set<number>;
  months: Set<number>;
  timeZone?: string;
  weekdays: Set<number>;
  weekdayWildcard: boolean;
};

export function parseHourlyCronFields(value: unknown): HourlyCronFields | null {
  if (typeof value !== "string") return null;
  const spec = parseCronSpec(value);
  if (!spec) return null;
  const fields = (DESCRIPTOR_CRON[spec.expression] ?? spec.expression).split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute = "", hour = "", day = "", month = "", weekday = ""] = fields;
  const minutes = parseCronField(minute, 0, 59);
  const hours = parseCronField(hour, 0, 23);
  const days = parseCronField(day, 1, 31);
  const months = parseCronField(month, 1, 12, MONTH_ALIASES);
  const weekdays = parseCronField(weekday, 0, 6, WEEKDAY_ALIASES);
  if (minutes?.size !== 1 || !hours || !days || !months || !weekdays) return null;
  return {
    days,
    dayWildcard: isWildcardField(day),
    hours,
    minutes,
    months,
    ...(spec.timeZone ? { timeZone: spec.timeZone } : {}),
    weekdays,
    weekdayWildcard: isWildcardField(weekday),
  };
}

/** Validates Vega's five-field cron contract and its one-hour minimum interval. */
export function isHourlyCron(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const spec = parseCronSpec(value);
  if (!spec) return false;
  return (
    parseEveryDuration(spec.expression) !== null ||
    parseHourlyCronFields(value) !== null
  );
}

type CronCalendarDate = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  weekday: number;
  year: number;
};

function calendarDateAt(value: number, timeZone?: string): CronCalendarDate {
  const date = new Date(value);
  if (!timeZone) {
    return {
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      month: date.getMonth() + 1,
      weekday: date.getDay(),
      year: date.getFullYear(),
    };
  }
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    timeZone,
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    day: Number(part("day")),
    hour: Number(part("hour")),
    minute: Number(part("minute")),
    month: Number(part("month")),
    weekday: WEEKDAY_ALIASES[part("weekday").toUpperCase()] ?? -1,
    year: Number(part("year")),
  };
}

function candidateTimes(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone?: string,
): number[] {
  if (!timeZone) return [new Date(year, month - 1, day, hour, minute).getTime()];
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set<number>();
  for (const probe of [wallTime - 86_400_000, wallTime, wallTime + 86_400_000]) {
    const parts = calendarDateAt(probe, timeZone);
    offsets.add(
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
        Math.floor(probe / 60_000) * 60_000,
    );
  }
  return [...offsets]
    .map((offset) => wallTime - offset)
    .filter((candidate) => {
      const parts = calendarDateAt(candidate, timeZone);
      return (
        parts.year === year && parts.month === month && parts.day === day &&
        parts.hour === hour && parts.minute === minute
      );
    })
    .sort((left, right) => left - right);
}

export function calculateNextHourlyCronRun(
  cronExpr: string,
  now: number,
  startTime?: number,
): number | undefined {
  const spec = parseCronSpec(cronExpr);
  if (!spec) return undefined;
  const delay = parseEveryDuration(spec.expression);
  const from = startTime && startTime > now ? startTime - 1 : now;
  if (delay !== null) {
    return Math.floor(from / 1_000) * 1_000 + delay;
  }
  const fields = parseHourlyCronFields(cronExpr);
  if (!fields) return undefined;
  const {
    days, dayWildcard, hours, minutes, months, timeZone,
    weekdays, weekdayWildcard,
  } = fields;
  const minute = minutes.values().next().value;
  if (minute === undefined) return undefined;
  const sortedHours = [...hours].sort((left, right) => left - right);
  const initialDate = calendarDateAt(from, timeZone);
  const calendarDay = new Date(Date.UTC(
    initialDate.year, initialDate.month - 1, initialDate.day,
  ));
  const yearLimit = initialDate.year + 5;
  while (calendarDay.getUTCFullYear() <= yearLimit) {
    const year = calendarDay.getUTCFullYear();
    const month = calendarDay.getUTCMonth() + 1;
    const day = calendarDay.getUTCDate();
    const dayMatches = days.has(day);
    const weekdayMatches = weekdays.has(calendarDay.getUTCDay());
    const calendarDayMatches = dayWildcard || weekdayWildcard
      ? dayMatches && weekdayMatches
      : dayMatches || weekdayMatches;
    if (months.has(month) && calendarDayMatches) {
      for (const hour of sortedHours) {
        for (const candidate of candidateTimes(
          year, month, day, hour, minute, timeZone,
        )) {
          if (candidate > from) return candidate;
        }
      }
    }
    calendarDay.setUTCDate(calendarDay.getUTCDate() + 1);
  }
  return undefined;
}
