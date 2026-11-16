/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  cronFromSchedule,
  describeSchedule,
  scheduleFromCron,
  timezoneOptions,
} from "@/modules/knowledge-network/components/event-class/event-schedule";

describe("event check schedule", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it.each([
    ["*/15 * * * *", { kind: "minutes", every: 15 }],
    ["0 */2 * * *", { kind: "hours", every: 2 }],
    ["0 8 * * *", { kind: "daily", time: "08:00" }],
    ["30 9 * * 1", { kind: "weekly", time: "09:30", weekday: 1 }],
  ])("reads %s as a preset and writes it back the same", (cron, schedule) => {
    expect(scheduleFromCron(cron)).toEqual(schedule);
    expect(cronFromSchedule(scheduleFromCron(cron))).toBe(cron);
  });

  it.each(["*/2 * * * *", "0 8 1 * *", "0 8 * * 1-5", "0 8,20 * * *"])(
    "keeps %s as an expression when no preset says the same",
    (cron) => {
      expect(scheduleFromCron(cron)).toEqual({ kind: "cron", cron });
      expect(cronFromSchedule(scheduleFromCron(cron))).toBe(cron);
    },
  );

  it("offers a daily check for a type that has no schedule yet", () => {
    expect(scheduleFromCron(undefined)).toEqual({ kind: "daily", time: "08:00" });
  });

  it("reads a schedule for people, with its time zone", async () => {
    await i18n.changeLanguage("en-US");
    const t = i18n.t.bind(i18n);
    expect(describeSchedule("0 8 * * *", t, "Asia/Shanghai")).toBe(
      "Daily at 08:00 (Asia/Shanghai)",
    );
    expect(describeSchedule("*/5 * * * *", t)).toBe("Every 5 minutes");
    expect(describeSchedule("0 */1 * * *", t)).toBe("Every 1 hour");
    expect(describeSchedule("30 9 * * 1", t)).toBe("Every Monday at 09:30");
    expect(describeSchedule("0 8 1 * *", t)).toBe("Cron: 0 8 1 * *");
  });

  it("puts the default time zone first", () => {
    expect(timezoneOptions()[0]).toBe("Asia/Shanghai");
    expect(timezoneOptions().filter((zone) => zone === "Asia/Shanghai")).toHaveLength(1);
  });
});
