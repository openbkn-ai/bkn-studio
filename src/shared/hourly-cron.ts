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
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!range || !Number.isInteger(step) || step <= 0) return null;
    const rangeParts = range.split("-");
    if (rangeParts.length > 2) return null;
    const [startText, explicitEndText] =
      range === "*" || range === "?"
        ? [String(min), String(max)]
        : rangeParts;
    if (!startText || explicitEndText === "") return null;
    const start = aliases?.[startText.toUpperCase()] ?? Number(startText);
    const endText =
      explicitEndText ?? (stepText === undefined ? startText : String(max));
    const end = aliases?.[endText.toUpperCase()] ?? Number(endText);
    if (
      !Number.isInteger(start) || !Number.isInteger(end) ||
      start < min || end > max || start > end
    ) return null;
    for (let item = start; item <= end; item += step) values.add(item);
  }
  return values;
}

export type HourlyCronFields = {
  days: Set<number>;
  dayWildcard: boolean;
  hours: Set<number>;
  minutes: Set<number>;
  months: Set<number>;
  weekdays: Set<number>;
  weekdayWildcard: boolean;
};

export function parseHourlyCronFields(value: unknown): HourlyCronFields | null {
  if (typeof value !== "string") return null;
  const fields = value.trim().split(/\s+/);
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
    dayWildcard: day === "*" || day === "?",
    hours,
    minutes,
    months,
    weekdays,
    weekdayWildcard: weekday === "*" || weekday === "?",
  };
}

/** Validates Vega's five-field cron contract and its one-hour minimum interval. */
export function isHourlyCron(value: unknown): value is string {
  return parseHourlyCronFields(value) !== null;
}

export function calculateNextHourlyCronRun(
  cronExpr: string,
  now: number,
  startTime?: number,
): number | undefined {
  const fields = parseHourlyCronFields(cronExpr);
  if (!fields) return undefined;
  const { days, dayWildcard, hours, minutes, months, weekdays, weekdayWildcard } = fields;
  const from = startTime && startTime > now ? startTime - 1 : now;
  const candidate = new Date(Math.floor(from / 60_000) * 60_000 + 60_000);
  const searchLimit = candidate.getTime() + 370 * 24 * 60 * 60_000;
  while (candidate.getTime() <= searchLimit) {
    const dayMatches = days.has(candidate.getDate());
    const weekdayMatches = weekdays.has(candidate.getDay());
    const calendarDayMatches = dayWildcard
      ? weekdayMatches
      : weekdayWildcard
        ? dayMatches
        : dayMatches || weekdayMatches;
    if (
      minutes.has(candidate.getMinutes()) && hours.has(candidate.getHours()) &&
      months.has(candidate.getMonth() + 1) && calendarDayMatches
    ) return candidate.getTime();
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return undefined;
}
