/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

import type { KnEventCheckSchedule } from "@/modules/knowledge-network/types/event-type";

/**
 * A rule's check schedule as the form offers it. The backend keeps a five-field cron expression;
 * the common shapes are edited as presets and anything else as the expression itself.
 */
export type EventScheduleDraft =
  | { kind: "minutes"; every: number }
  | { kind: "hours"; every: number }
  | { kind: "daily"; time: string }
  | { kind: "weekly"; time: string; weekday: number }
  | { kind: "cron"; cron: string };

export const DEFAULT_EVENT_TIMEZONE = "Asia/Shanghai";
export const DEFAULT_EVENT_SCHEDULE: EventScheduleDraft = { kind: "daily", time: "08:00" };

/** Two checks are at least five minutes apart on the backend. */
export const MIN_CHECK_MINUTES = 5;

const NUMBER = /^\d+$/;

function readTime(minute: string, hour: string): string | undefined {
  if (!NUMBER.test(minute) || !NUMBER.test(hour)) return undefined;
  const m = Number(minute);
  const h = Number(hour);
  if (m > 59 || h > 23) return undefined;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The preset a cron expression is, or the expression itself when it is none of them. */
export function scheduleFromCron(cron: string | undefined): EventScheduleDraft {
  const text = (cron ?? "").trim();
  if (!text) return DEFAULT_EVENT_SCHEDULE;
  const fields = text.split(/\s+/);
  if (fields.length !== 5) return { kind: "cron", cron: text };
  const [minute, hour, day, month, weekday] = fields;
  if (day === "*" && month === "*" && weekday === "*") {
    const minuteStep = /^\*\/(\d+)$/.exec(minute);
    if (minuteStep && hour === "*") {
      const every = Number(minuteStep[1]);
      if (every >= MIN_CHECK_MINUTES && every <= 59) return { kind: "minutes", every };
    }
    const hourStep = /^\*\/(\d+)$/.exec(hour);
    if (hourStep && minute === "0") {
      const every = Number(hourStep[1]);
      if (every >= 1 && every <= 23) return { kind: "hours", every };
    }
    const time = readTime(minute, hour);
    if (time) return { kind: "daily", time };
  }
  if (day === "*" && month === "*" && /^[0-6]$/.test(weekday)) {
    const time = readTime(minute, hour);
    if (time) return { kind: "weekly", time, weekday: Number(weekday) };
  }
  return { kind: "cron", cron: text };
}

function timeFields(time: string): [string, string] {
  const [hour = "0", minute = "0"] = time.split(":");
  return [String(Number(minute)), String(Number(hour))];
}

export function cronFromSchedule(schedule: EventScheduleDraft): string {
  switch (schedule.kind) {
    case "minutes":
      return `*/${schedule.every} * * * *`;
    case "hours":
      return `0 */${schedule.every} * * *`;
    case "daily": {
      const [minute, hour] = timeFields(schedule.time);
      return `${minute} ${hour} * * *`;
    }
    case "weekly": {
      const [minute, hour] = timeFields(schedule.time);
      return `${minute} ${hour} * * ${schedule.weekday}`;
    }
    case "cron":
      return schedule.cron.trim();
  }
}

/** A short reading of a schedule, such as "Daily at 08:00". */
export function describeSchedule(
  cron: string | undefined,
  t: TFunction,
  timezone?: string,
): string {
  const schedule = scheduleFromCron(cron);
  const prefix = "knowledgeNetwork.eventClasses.schedule.describe";
  let text: string;
  switch (schedule.kind) {
    case "minutes":
      text = t(`${prefix}.minutes`, { count: schedule.every });
      break;
    case "hours":
      text = t(`${prefix}.hours`, { count: schedule.every });
      break;
    case "daily":
      text = t(`${prefix}.daily`, { time: schedule.time });
      break;
    case "weekly":
      text = t(`${prefix}.weekly`, {
        time: schedule.time,
        weekday: t(`knowledgeNetwork.eventClasses.schedule.weekdays.${schedule.weekday}`),
      });
      break;
    case "cron":
      text = t(`${prefix}.cron`, { cron: schedule.cron });
      break;
  }
  return timezone ? `${text} (${timezone})` : text;
}

/** How a class is checked: its cron in words, or the fixed rate it keeps. */
export function describeCheckSchedule(schedule: KnEventCheckSchedule, t: TFunction): string {
  if (!schedule.rate) return describeSchedule(schedule.cron, t, schedule.timezone);
  const text = t("knowledgeNetwork.eventClasses.schedule.describe.rate", { rate: schedule.rate });
  return schedule.timezone ? `${text} (${schedule.timezone})` : text;
}

/** IANA time zones the runtime knows, the default first. */
export function timezoneOptions(): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = typeof supported === "function" ? supported("timeZone") : [];
  return [DEFAULT_EVENT_TIMEZONE, ...zones.filter((zone) => zone !== DEFAULT_EVENT_TIMEZONE)];
}
