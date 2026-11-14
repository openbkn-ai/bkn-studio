/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { commonEnUS } from "@/app/locales/resources/common/en-US";
import { commonZhCN } from "@/app/locales/resources/common/zh-CN";
import {
  ScheduleRunResultView,
  normalizeScheduleLastStatus,
  isHourlyCron,
} from "@/shared/schedule";
import type { ScheduleLastStatus } from "@/shared/schedule";

describe("ScheduleRunResultView", () => {
  it.each(["en-US", "zh-CN"])(
    "shows trigger outcomes and raw server messages in %s",
    async (language) => {
      const i18n = createInstance();
      await i18n.init({
        lng: language,
        resources: { "en-US": { translation: commonEnUS }, "zh-CN": { translation: commonZhCN } },
      });
      const translations =
        language === "zh-CN" ? commonZhCN.common.schedule : commonEnUS.common.schedule;
      const message = "Server explanation\n<raw text>";
      const { rerender } = render(
        <I18nextProvider i18n={i18n}>
          <ScheduleRunResultView status="success" message={message} />
        </I18nextProvider>,
      );
      expect(screen.getByText(translations.taskCreated)).toBeInTheDocument();
      expect(screen.getByText("Server explanation <raw text>")).toHaveTextContent("<raw text>");
      for (const status of ["never", "unknown", "triggering", "skipped", "failed"] as const) {
        rerender(
          <I18nextProvider i18n={i18n}>
            <ScheduleRunResultView status={status} />
          </I18nextProvider>,
        );
        expect(screen.getByText(translations.status[status])).toBeInTheDocument();
      }
      rerender(
        <I18nextProvider i18n={i18n}>
          <ScheduleRunResultView status="success" kind="health-check" />
        </I18nextProvider>,
      );
      expect(screen.getByText(translations.healthCheckSucceeded)).toBeInTheDocument();
      for (const status of [undefined, "new-server-state" as ScheduleLastStatus]) {
        rerender(
          <I18nextProvider i18n={i18n}>
            <ScheduleRunResultView status={status} />
          </I18nextProvider>,
        );
        expect(screen.getByText(translations.status.unknown)).toBeInTheDocument();
        expect(screen.queryByText(translations.taskCreated)).not.toBeInTheDocument();
      }
    },
  );
});

describe("schedule compatibility", () => {
  it("never infers success from historical trigger timestamps", () => {
    expect(normalizeScheduleLastStatus(undefined, 100)).toBe("unknown");
    expect(normalizeScheduleLastStatus(undefined, 0)).toBe("never");
    expect(normalizeScheduleLastStatus("future-state", 0)).toBe("unknown");
    expect(normalizeScheduleLastStatus("failed", 100)).toBe("failed");
  });
  it("shares the existing timezone and hourly cron rules", () => {
    expect(isHourlyCron("CRON_TZ=Asia/Shanghai 0 * * * *")).toBe(true);
    expect(isHourlyCron("@every 2h")).toBe(true);
    expect(isHourlyCron("*/30 * * * *")).toBe(false);
  });
});
