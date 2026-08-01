/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { HealthCheckScheduleFormModal } from "@/modules/data-connect/components/HealthCheckScheduleFormModal";

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

describe("HealthCheckScheduleFormModal", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it("submits the custom cron expression for enabled mode", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <HealthCheckScheduleFormModal
        loading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        open
        schedule={{
          catalogId: "catalog-1",
          cronExpr: "0 * * * *",
          lastRun: "-",
          mode: "enabled",
          nextRun: "-",
        }}
      />,
    );

    await waitFor(() => {
      const cronInput = screen.getByPlaceholderText(
        "dataConnect.healthCheckSchedule.cronPlaceholder",
      );
      expect(cronInput.getAttribute("value")).toBe("0 * * * *");
    });

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        cronExpr: "0 * * * *",
        mode: "enabled",
      }),
    );
  });

  it("rejects a schedule that runs more than once per hour", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <HealthCheckScheduleFormModal
        loading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        open
        schedule={{
          catalogId: "catalog-1",
          cronExpr: "0 * * * *",
          lastRun: "-",
          mode: "enabled",
          nextRun: "-",
        }}
      />,
    );

    const cronInput = await screen.findByPlaceholderText(
      "dataConnect.healthCheckSchedule.cronPlaceholder",
    );
    fireEvent.change(cronInput, { target: { value: "*/5 * * * *" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(
        screen.getByText("dataConnect.healthCheckSchedule.cronInvalid"),
      ).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
